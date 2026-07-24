#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

let XLSX;

const writers = {
  wechat: writeWechat,
  xiaohongshu: writeXiaohongshu,
  zhihu: writeZhihu,
  toutiao: writeToutiao,
  weibo: writeWeibo
};

try {
  run();
} catch (error) {
  process.stderr.write(`ERROR: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}

function run() {
  const args = parseArgs(process.argv.slice(2));
  const manifestPath = path.resolve(requiredArg(args, "manifest"));
  const projectRoot = path.resolve(requiredArg(args, "project-root"));
  const outputDir = path.resolve(requiredArg(args, "output"));

  assertDashboard(projectRoot);
  const requireFromProject = createRequire(path.join(projectRoot, "package.json"));
  try {
    XLSX = requireFromProject("xlsx");
    requireFromProject.resolve("tsx");
  } catch {
    fail("The dashboard dependencies 'xlsx' and 'tsx' are required.");
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  validateManifest(manifest);
  assertValidatedCollection(manifestPath, manifest);
  if (path.basename(outputDir) !== manifest.run.id) {
    fail("--output must end with the manifest run.id to isolate this import batch");
  }
  if (fs.existsSync(outputDir) && fs.lstatSync(outputDir).isSymbolicLink()) {
    fail("Refusing to write through a symlink batch directory");
  }

  const parent = path.dirname(outputDir);
  fs.mkdirSync(parent, { recursive: true });
  const staging = fs.mkdtempSync(path.join(parent, `.${manifest.run.id}-${manifest.run.platform}-`));
  try {
    const stagedFiles = writers[manifest.run.platform](manifest, staging);
    const validation = validateGeneratedFiles(stagedFiles, manifest, projectRoot);
    const files = commitBatch(stagedFiles, staging, outputDir);
    const warnings = manifest.run.platform === "xiaohongshu"
      ? ["Xiaohongshu content compatibility export is disabled until the dashboard parser preserves snapshot date and publish time."]
      : [];
    process.stdout.write(`${JSON.stringify({
      status: "success",
      platform: manifest.run.platform,
      runId: manifest.run.id,
      files,
      validation,
      warnings
    })}\n`);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    if (!key?.startsWith("--") || values[index + 1] == null) fail(`Invalid argument near ${key ?? "end"}`);
    parsed[key.slice(2)] = values[index + 1];
  }
  return parsed;
}

function requiredArg(value, name) {
  if (!value[name]) fail(`Missing --${name}`);
  return value[name];
}

function fail(message) {
  throw new Error(message);
}

function assertDashboard(root) {
  const packagePath = path.join(root, "package.json");
  const parserPath = path.join(root, "lib/import/parsers.ts");
  const importPath = path.join(root, "scripts/import-social-data.ts");
  if (!fs.existsSync(packagePath) || !fs.existsSync(parserPath) || !fs.existsSync(importPath)) {
    fail(`Not a supported dashboard root: ${root}`);
  }
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  if (packageJson.name !== "social-media-analytics-app") fail(`Unexpected package name: ${packageJson.name}`);
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function assertValidatedCollection(manifestPath, manifest) {
  if (path.basename(manifestPath) !== "collection.json") {
    fail("Dashboard exports only accept collection.json emitted by export_collection.py");
  }
  const reportPath = path.join(path.dirname(manifestPath), "collection-report.json");
  if (!fs.existsSync(reportPath)) fail("Missing collection-report.json next to collection.json");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const entry = report.files?.find((file) => file.name === "collection.json");
  if (
    report.schema_version !== 1 ||
    report.run_id !== manifest.run.id ||
    report.platform !== manifest.run.platform ||
    report.status !== manifest.run.status ||
    !entry ||
    entry.sha256 !== sha256(manifestPath) ||
    entry.bytes !== fs.statSync(manifestPath).size
  ) {
    fail("collection-report.json does not authenticate this collection.json");
  }
}

function parseIsoDate(value, name) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(`${name} must use YYYY-MM-DD`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail(`${name} is invalid`);
  return value;
}

function validateManifest(value) {
  const platforms = new Set(["wechat", "xiaohongshu", "zhihu", "toutiao", "weibo"]);
  if (value?.schema_version !== 1 || !platforms.has(value?.run?.platform)) fail("Invalid collection manifest");
  const statusAllowed = value.run.platform === "weibo"
    ? new Set(["success", "partial"])
    : new Set(["success"]);
  if (!statusAllowed.has(value.run.status)) fail("Dashboard exports require validated success data; Weibo may be partial");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(value.run.id ?? "")) fail("Invalid manifest run.id");
  const start = parseIsoDate(value.run?.range?.start, "run.range.start");
  const end = parseIsoDate(value.run?.range?.end, "run.range.end");
  if (start > end) fail("Manifest date range is reversed");
  if (!Array.isArray(value.account_daily) || !Array.isArray(value.contents)) fail("Manifest rows must be arrays");
  const dates = value.account_daily.map((row, index) => parseIsoDate(row.date, `account_daily[${index}].date`));
  if (new Set(dates).size !== dates.length) fail("Duplicate daily dates in manifest");
  if (dates.some((date) => date < start || date > end)) {
    fail("Daily date is outside the manifest range");
  }
}

function ensureWithin(root, filePath) {
  const relative = path.relative(root, filePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    fail(`Generated file escaped its staging directory: ${filePath}`);
  }
  return relative;
}

function assertNoSymlinkComponents(root, filePath) {
  const relativeParent = path.dirname(ensureWithin(root, filePath));
  let current = root;
  if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
    fail(`Refusing to write through symlink directory: ${current}`);
  }
  for (const component of relativeParent.split(path.sep)) {
    if (component === ".") continue;
    current = path.join(current, component);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
      fail(`Refusing to write through symlink directory: ${current}`);
    }
  }
}

function commitBatch(stagedFiles, staging, outputDir) {
  const entries = stagedFiles.map((filePath) => ({
    filePath,
    target: path.join(outputDir, ensureWithin(staging, filePath))
  }));
  for (const { target } of entries) {
    assertNoSymlinkComponents(outputDir, target);
    if (fs.existsSync(target)) fail(`Refusing to overwrite an existing batch file: ${target}`);
  }
  const moved = [];
  try {
    for (const { filePath, target } of entries) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const canonicalRoot = fs.realpathSync(outputDir);
      const canonicalParent = fs.realpathSync(path.dirname(target));
      const canonicalRelative = path.relative(canonicalRoot, canonicalParent);
      if (canonicalRelative.startsWith("..") || path.isAbsolute(canonicalRelative)) {
        fail(`Generated file escaped its batch directory: ${target}`);
      }
      fs.renameSync(filePath, target);
      moved.push(target);
    }
  } catch (error) {
    for (const target of moved) fs.rmSync(target, { force: true });
    throw error;
  }
  return entries.map(({ target }) => target);
}

function parseWithDashboard(files, projectRoot) {
  if (!files.length) return [];
  const parserCode = `
import { parseSocialFile } from "./lib/import/parsers.ts";
const files = JSON.parse(process.argv[1]);
console.log(JSON.stringify(files.map((file) => ({ file, ...parseSocialFile(file) }))));
`;
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", parserCode, JSON.stringify(files)],
    { cwd: projectRoot, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
  );
  if (result.status !== 0) fail(`parseSocialFile() validation failed: ${result.stderr.trim() || result.stdout.trim()}`);
  try {
    return JSON.parse(result.stdout.trim());
  } catch {
    fail("parseSocialFile() returned invalid validation output");
  }
}

function parserSpec(filename) {
  if (filename === "user_analysis.xls") {
    return {
      parserKey: "wechat_user_growth_html_xls",
      platform: "wechat",
      mappings: [["followersTotal", "followers_total"], ["followersNew", "followers_new"], ["followersLost", "followers_lost"]]
    };
  }
  if (filename.startsWith("tendency_") && filename.endsWith(".xls")) {
    return {
      parserKey: "wechat_tendency_ole_xls",
      platform: "wechat",
      mappings: [["viewsTotal", "views"], ["sharesTotal", "shares"], ["savesTotal", "saves"], ["postsCount", "posts"]]
    };
  }
  if (filename === "近30日观看数据.xlsx") {
    return {
      parserKey: "xhs_30day_watch_xlsx",
      platform: "xiaohongshu",
      mappings: [["impressionsTotal", "impressions"], ["viewsTotal", "views"]]
    };
  }
  if (filename === "日报表.xls") {
    return {
      parserKey: "zhihu_daily_csv_xls",
      platform: "zhihu",
      mappings: [["viewsTotal", "views"], ["likesTotal", "likes"], ["commentsTotal", "comments"], ["savesTotal", "saves"], ["sharesTotal", "shares"]]
    };
  }
  if (filename.startsWith("数据趋势_") && filename.endsWith(".xlsx")) {
    return {
      parserKey: "toutiao_data_trend_xlsx",
      platform: "toutiao",
      mappings: [["impressionsTotal", "impressions"], ["viewsTotal", "views"], ["likesTotal", "likes"], ["commentsTotal", "comments"]]
    };
  }
  if (filename.startsWith("粉丝趋势_") && filename.endsWith(".xlsx")) {
    return {
      parserKey: "toutiao_follower_trend_xlsx",
      platform: "toutiao",
      mappings: [["followersTotal", "followers_total"], ["followersNew", "followers_new"], ["followersLost", "followers_lost"]]
    };
  }
  fail(`No parser validation contract for ${filename}`);
}

function validateParsedAccount(result, manifest, spec) {
  if (spec.platform !== manifest.run.platform || result.parserKey !== spec.parserKey || result.platformId !== spec.platform) {
    fail(`Unexpected parser result for ${path.basename(result.file)}`);
  }
  const metrics = result.accountMetrics ?? [];
  if (metrics.length !== manifest.account_daily.length) {
    fail(`${path.basename(result.file)} parsed ${metrics.length} rows; expected ${manifest.account_daily.length}`);
  }
  const byDate = new Map();
  for (const metric of metrics) {
    if (byDate.has(metric.statDate)) fail(`Duplicate parsed date ${metric.statDate} in ${path.basename(result.file)}`);
    byDate.set(metric.statDate, metric);
  }
  for (const expected of manifest.account_daily) {
    const actual = byDate.get(expected.date);
    if (!actual) fail(`Missing parsed date ${expected.date} in ${path.basename(result.file)}`);
    for (const [parsedName, manifestName] of spec.mappings) {
      const parsedValue = actual[parsedName] ?? null;
      const expectedValue = expected[manifestName] ?? null;
      if (parsedValue !== expectedValue) {
        fail(`${path.basename(result.file)} ${expected.date} ${parsedName}=${parsedValue}; expected ${expectedValue}`);
      }
    }
  }
  return { file: path.basename(result.file), parserKey: result.parserKey, rows: metrics.length };
}

function validateWeiboWorkbook(filePath, manifest) {
  const workbook = XLSX.readFile(filePath);
  const expectedSheets = ["账号汇总", "每日趋势", "单条博文", "说明"];
  if (JSON.stringify(workbook.SheetNames) !== JSON.stringify(expectedSheets)) fail("Invalid Weibo workbook sheets");

  const summaryRows = XLSX.utils.sheet_to_json(workbook.Sheets["账号汇总"], { header: 1, defval: null });
  if (summaryRows[2]?.[1] !== safeSheetValue(manifest.run.account_name)) fail("Invalid Weibo account name");

  const dailyRows = XLSX.utils.sheet_to_json(workbook.Sheets["每日趋势"], { defval: null });
  if (dailyRows.length !== manifest.account_daily.length) fail("Invalid Weibo daily row count");
  const dailyByDate = new Map(dailyRows.map((row) => [row["日期"], row]));
  const mappings = [
    ["粉丝总数", "followers_total"], ["新增粉丝数", "followers_new"], ["减少粉丝数", "followers_lost"],
    ["阅读数", "views"], ["发博数", "posts"], ["转评赞数", "engagement"],
    ["转发数", "reposts"], ["评论数", "comments"], ["点赞数", "likes"]
  ];
  for (const expected of manifest.account_daily) {
    const actual = dailyByDate.get(expected.date);
    if (!actual) fail(`Missing Weibo date ${expected.date}`);
    const expectedNet = rawNumber(expected, "粉丝净增", "净增粉丝数") ?? (
      expected.followers_new != null && expected.followers_lost != null
        ? expected.followers_new - expected.followers_lost
        : null
    );
    if ((actual["粉丝净增数"] ?? null) !== expectedNet) fail(`Invalid Weibo net followers on ${expected.date}`);
    for (const [column, metric] of mappings) {
      if ((actual[column] ?? null) !== (expected[metric] ?? null)) {
        fail(`Weibo ${expected.date} ${column} does not match ${metric}`);
      }
    }
  }

  const contentRows = XLSX.utils.sheet_to_json(workbook.Sheets["单条博文"], { defval: null });
  if (contentRows.length !== manifest.contents.length) fail("Invalid Weibo content row count");
  for (let index = 0; index < contentRows.length; index += 1) {
    const actual = contentRows[index];
    const expected = manifest.contents[index];
    if (
      actual["发布时间"] !== safeSheetValue(expected.publish_time) ||
      actual["微博内容"] !== safeSheetValue(expected.title) ||
      (actual["阅读数"] ?? null) !== (expected.views ?? null) ||
      (actual.URL ?? null) !== (expected.url ?? null)
    ) {
      fail(`Invalid Weibo content row ${index + 1}`);
    }
  }
  return { file: path.basename(filePath), parserKey: null, rows: dailyRows.length };
}

function validateGeneratedFiles(files, manifest, projectRoot) {
  const expectedCounts = { wechat: 2, xiaohongshu: 1, zhihu: 1, toutiao: 2, weibo: 1 };
  if (files.length !== expectedCounts[manifest.run.platform]) fail("Unexpected generated file count");
  for (const filePath of files) {
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) fail(`Generated file is empty: ${filePath}`);
  }

  const weiboFiles = files.filter((filePath) => path.basename(path.dirname(filePath)) === "weibo");
  if (weiboFiles.length) {
    return [validateWeiboWorkbook(weiboFiles[0], manifest)];
  }

  return parseWithDashboard(files, projectRoot).map((result) => {
    const spec = parserSpec(path.basename(result.file));
    return validateParsedAccount(result, manifest, spec);
  });
}

function sortedDaily(value) {
  return [...value.account_daily].sort((left, right) => left.date.localeCompare(right.date));
}

function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function safeSheetValue(value) {
  if (typeof value !== "string") return value;
  const cleaned = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  return /^[\s\u0000-\u001f]*[=+@-]/.test(cleaned) ? `'${cleaned}` : cleaned;
}

function rawNumber(row, ...names) {
  for (const name of names) {
    const value = row.raw?.[name];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function sumExact(rows, key) {
  const values = rows.map((row) => numberOrNull(row[key]));
  return values.every((value) => value != null) ? values.reduce((total, value) => total + value, 0) : null;
}

function sumValuesIfComplete(values) {
  return values.every((value) => value != null) ? values.reduce((total, value) => total + value, 0) : null;
}

function safeRange(value) {
  return `${value.run.range.start}-${value.run.range.end}`;
}

function writeBook(filePath, sheets, bookType = "xlsx") {
  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of sheets) {
    const safeRows = rows.map((row) => row.map(safeSheetValue));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(safeRows), name);
  }
  XLSX.writeFile(workbook, filePath, { bookType, compression: true });
  return filePath;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function htmlTable(headers, rows) {
  const head = headers.map((value) => `<th>${escapeHtml(value)}</th>`).join("");
  const body = rows
    .map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"></head><body><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
}

function writeWechat(value, output) {
  const daily = sortedDaily(value);
  const userPath = path.join(output, "user_analysis.xls");
  const userHeaders = ["时间", "新关注人数", "取消关注人数", "净增关注人数", "累积关注人数"];
  const userRows = daily.map((row) => {
    const followersNew = numberOrNull(row.followers_new);
    const followersLost = numberOrNull(row.followers_lost);
    const net = rawNumber(row, "净增关注人数") ?? (
      followersNew != null && followersLost != null ? followersNew - followersLost : null
    );
    return [row.date, followersNew, followersLost, net, numberOrNull(row.followers_total)];
  });
  fs.writeFileSync(userPath, htmlTable(userHeaders, userRows), "utf8");

  const trendName = `tendency_${value.run.range.start.replaceAll("-", "")}_${value.run.range.end.replaceAll("-", "")}.xls`;
  const trendPath = path.join(output, trendName);
  const trendRows = [
    ["图文群发每日数据"],
    ["日期", "渠道", "阅读人数", "", "日期", "分享人数", "跳转阅读原文", "微信收藏人数", "发表篇数"],
    ...daily.map((row) => [
      row.date,
      "全部",
      numberOrNull(row.views),
      null,
      row.date,
      numberOrNull(row.shares),
      rawNumber(row, "跳转阅读原文"),
      numberOrNull(row.saves),
      numberOrNull(row.posts)
    ])
  ];
  writeBook(trendPath, [["Sheet1", trendRows]], "biff8");
  return [userPath, trendPath];
}

function writeXiaohongshu(value, output) {
  const daily = sortedDaily(value);
  const watchPath = path.join(output, "近30日观看数据.xlsx");
  const summaryRows = [
    ["指标", "数值"],
    ["曝光", value.summary.impressions ?? sumExact(daily, "impressions")],
    ["观看", value.summary.views ?? sumExact(daily, "views")]
  ];
  const impressionRows = [["日期", "数值"], ...daily.map((row) => [row.date, numberOrNull(row.impressions)])];
  const viewRows = [["日期", "数值"], ...daily.map((row) => [row.date, numberOrNull(row.views)])];
  writeBook(watchPath, [
    ["账号总体观看数据", summaryRows],
    ["曝光趋势", impressionRows],
    ["观看趋势", viewRows]
  ]);
  return [watchPath];
}

function csvCell(value) {
  const text = String(safeSheetValue(value ?? ""));
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeZhihu(value, output) {
  const daily = sortedDaily(value);
  const filePath = path.join(output, "日报表.xls");
  const rows = [
    ["日期", "阅读", "播放", "点赞", "喜欢", "评论", "收藏", "分享"],
    ...daily.map((row) => {
      return [
        row.date,
        rawNumber(row, "阅读"),
        rawNumber(row, "播放"),
        rawNumber(row, "点赞"),
        rawNumber(row, "喜欢"),
        numberOrNull(row.comments),
        numberOrNull(row.saves),
        numberOrNull(row.shares)
      ];
    })
  ];
  fs.writeFileSync(filePath, `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`, "utf8");
  return [filePath];
}

function writeToutiao(value, output) {
  const daily = sortedDaily(value);
  const dataPath = path.join(output, `数据趋势_${safeRange(value)}.xlsx`);
  const dataHeaders = ["时间", "展现量", "粉丝展现量", "阅读(播放)量", "粉丝阅读(播放)量", "点赞量", "评论量"];
  const dataRows = [
    dataHeaders,
    [
      "累计",
      sumExact(daily, "impressions"),
      sumValuesIfComplete(daily.map((row) => rawNumber(row, "粉丝展现量"))),
      sumExact(daily, "views"),
      sumValuesIfComplete(daily.map((row) => rawNumber(row, "粉丝阅读(播放)量"))),
      sumExact(daily, "likes"),
      sumExact(daily, "comments")
    ],
    ...daily.map((row) => [
      row.date,
      numberOrNull(row.impressions),
      rawNumber(row, "粉丝展现量"),
      numberOrNull(row.views),
      rawNumber(row, "粉丝阅读(播放)量"),
      numberOrNull(row.likes),
      numberOrNull(row.comments)
    ])
  ];
  writeBook(dataPath, [["Sheet1", dataRows]]);

  const followerPath = path.join(output, `粉丝趋势_${safeRange(value)}.xlsx`);
  const followerRows = [
    ["时间", "总粉丝数", "粉丝变化数", "新增粉丝数", "流失粉丝数", "活跃粉丝数", "总铁粉数"],
    ...daily.map((row) => [
      row.date,
      numberOrNull(row.followers_total),
      numberOrNull(row.followers_new) != null && numberOrNull(row.followers_lost) != null
        ? row.followers_new - row.followers_lost
        : null,
      numberOrNull(row.followers_new),
      numberOrNull(row.followers_lost),
      rawNumber(row, "活跃粉丝数"),
      rawNumber(row, "总铁粉数")
    ])
  ];
  writeBook(followerPath, [["Sheet1", followerRows]]);
  return [dataPath, followerPath];
}

function writeWeibo(value, output) {
  const daily = sortedDaily(value);
  const directory = path.join(output, "weibo");
  fs.mkdirSync(directory, { recursive: true });
  const filePath = path.join(directory, `微博数据_${safeRange(value)}.xlsx`);
  const summaryRows = [
    ["字段", "值"],
    ["平台", "微博"],
    ["账号", value.run.account_name],
    ["账号ID", value.run.account_id ?? null],
    ["开始日期", value.run.range.start],
    ["结束日期", value.run.range.end],
    ...Object.entries(value.summary)
  ];
  const dailyRows = [
    ["日期", "粉丝总数", "粉丝净增数", "新增粉丝数", "减少粉丝数", "阅读数", "发博数", "转评赞数", "转发数", "评论数", "点赞数"],
    ...daily.map((row) => {
      const followersNew = numberOrNull(row.followers_new);
      const followersLost = numberOrNull(row.followers_lost);
      const net = rawNumber(row, "粉丝净增", "净增粉丝数") ?? (
        followersNew != null && followersLost != null ? followersNew - followersLost : null
      );
      return [
        row.date,
        numberOrNull(row.followers_total),
        net,
        followersNew,
        followersLost,
        numberOrNull(row.views),
        numberOrNull(row.posts),
        numberOrNull(row.engagement),
        numberOrNull(row.reposts),
        numberOrNull(row.comments),
        numberOrNull(row.likes)
      ];
    })
  ];
  const contentRows = [
    ["发布时间", "微博内容", "阅读数", "转评赞数", "点击数", "URL"],
    ...value.contents.map((content) => [
      content.publish_time,
      content.title,
      numberOrNull(content.views),
      rawNumber(content, "转评赞数") ?? sumValuesIfComplete([
        numberOrNull(content.likes), numberOrNull(content.comments), numberOrNull(content.shares)
      ]),
      rawNumber(content, "点击数"),
      content.url ?? null
    ])
  ];
  const noteRows = [
    ["项目", "说明"],
    ...Object.entries(value.series_sources).map(([name, source]) => [`来源:${name}`, JSON.stringify(source)]),
    ...value.limitations.map((item, index) => [`限制:${index + 1}`, item])
  ];
  writeBook(filePath, [
    ["账号汇总", summaryRows],
    ["每日趋势", dailyRows],
    ["单条博文", contentRows],
    ["说明", noteRows]
  ]);
  return [filePath];
}
