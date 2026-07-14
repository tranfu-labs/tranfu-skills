import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { genericAdapter, resolveAdapter } from "../adapters";
import type { AdapterContext, MediaAsset } from "../adapters/types";
import { CdpClient } from "../browser/cdp-client";
import { connectChrome, type ChromeConnection } from "../browser/chrome-launcher";
import { NetworkJournal } from "../browser/network-journal";
import { BrowserSession } from "../browser/session";
import type { ExtractedDocument } from "../extract/document";
import { renderMarkdown } from "../extract/markdown-renderer";
import { downloadMediaAssets } from "../media/default-downloader";
import { rewriteMarkdownMediaLinks } from "../media/markdown-media";
import { createLogger } from "../utils/logger";
import { normalizeUrl } from "../utils/url";

export type OutputFormat = "markdown" | "json";

export interface ConvertCommandOptions {
  url?: string;
  output?: string;
  format: OutputFormat;
  adapter?: string;
  debugDir?: string;
  cdpUrl?: string;
  browserPath?: string;
  chromeProfileDir?: string;
  headless: boolean;
  quiet: boolean;
  downloadMedia: boolean;
  mediaDir?: string;
  timeoutMs: number;
}

interface RuntimeResources {
  chrome: ChromeConnection;
  cdp: CdpClient;
  browser: BrowserSession;
  network: NetworkJournal;
}

interface SuccessfulConvertOutput {
  adapter: string;
  status: "ok";
  media: MediaAsset[];
  downloads: Awaited<ReturnType<typeof downloadMediaAssets>> | null;
  document: ExtractedDocument;
  markdown: string;
}

async function writeOutput(path: string, content: string): Promise<void> {
  const directory = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  if (directory) {
    await mkdir(directory, { recursive: true });
  }
  await writeFile(path, content, "utf8");
}

async function writeDebugArtifacts(
  debugDir: string,
  document: ExtractedDocument,
  markdown: string,
  browser: BrowserSession,
  network: NetworkJournal,
): Promise<void> {
  await mkdir(debugDir, { recursive: true });

  const html = await browser.getHTML().catch(() => "");
  const networkDump = await network.toJSON({ includeBodies: true });

  await Promise.all([
    writeFile(join(debugDir, "document.json"), JSON.stringify(document, null, 2), "utf8"),
    writeFile(join(debugDir, "markdown.md"), markdown, "utf8"),
    writeFile(join(debugDir, "page.html"), html, "utf8"),
    writeFile(join(debugDir, "network.json"), JSON.stringify(networkDump, null, 2), "utf8"),
  ]);
}

async function openRuntime(options: ConvertCommandOptions, debugEnabled: boolean): Promise<RuntimeResources> {
  const logger = createLogger(debugEnabled);
  const chrome = await connectChrome({
    cdpUrl: options.cdpUrl,
    browserPath: options.browserPath,
    profileDir: options.chromeProfileDir,
    headless: options.headless,
    logger,
  });

  const cdp = await CdpClient.connect(chrome.browserWsUrl);
  const browser = await BrowserSession.open(cdp);
  const network = new NetworkJournal(browser.targetSession, logger);
  await network.start();

  return {
    chrome,
    cdp,
    browser,
    network,
  };
}

async function closeRuntime(runtime: RuntimeResources | null | undefined): Promise<void> {
  if (!runtime) {
    return;
  }
  runtime.network.stop();
  await runtime.browser.close().catch(() => {});
  await runtime.cdp.close().catch(() => {});
  await runtime.chrome.close().catch(() => {});
}

export function formatOutputContent(format: OutputFormat, payload: SuccessfulConvertOutput): string {
  if (format === "json") {
    return JSON.stringify(payload, null, 2);
  }
  return payload.markdown;
}

function printOutput(content: string): void {
  process.stdout.write(content);
  if (!content.endsWith("\n")) {
    process.stdout.write("\n");
  }
}

export async function runConvertCommand(options: ConvertCommandOptions): Promise<void> {
  if (!options.url) {
    throw new Error("URL is required");
  }
  if (options.downloadMedia && !options.output) {
    throw new Error("--download-media requires --output so media paths can be rewritten relative to the saved output file");
  }
  if (options.quiet && !options.output) {
    throw new Error("--quiet requires --output so the captured content is not discarded");
  }

  const url = normalizeUrl(options.url);
  const runtime = await openRuntime(options, Boolean(options.debugDir));
  const logger = createLogger(Boolean(options.debugDir));

  try {
    const adapter = resolveAdapter({ url }, options.adapter);
    const context: AdapterContext = {
      input: { url },
      browser: runtime.browser,
      network: runtime.network,
      cdp: runtime.cdp,
      log: logger,
      outputFormat: options.format,
      timeoutMs: options.timeoutMs,
      downloadMedia: options.downloadMedia,
    };

    const result = await adapter.process(context);
    let document: ExtractedDocument | null = result.status === "ok" ? result.document : null;
    let media: MediaAsset[] = result.status === "ok" ? (result.media ?? []) : [];
    let mediaAdapter = adapter;

    if (!document && adapter.name !== genericAdapter.name && result.status === "no_document") {
      logger.info(`Adapter ${adapter.name} returned no structured document; falling back to generic extraction`);
      const fallback = await genericAdapter.process(context);
      if (fallback.status === "ok") {
        document = fallback.document;
        media = fallback.media ?? [];
        mediaAdapter = genericAdapter;
      }
    }

    if (!document) {
      throw new Error("Failed to extract a document from the target URL");
    }

    document.requestedUrl ??= url.toString();

    let markdown = renderMarkdown(document);
    let downloadResult: Awaited<ReturnType<typeof downloadMediaAssets>> | null = null;

    if (options.downloadMedia && options.output) {
      downloadResult = mediaAdapter.downloadMedia
        ? await mediaAdapter.downloadMedia({
            media,
            outputPath: options.output,
            mediaDir: options.mediaDir,
            log: logger,
          })
        : await downloadMediaAssets({
            media,
            outputPath: options.output,
            mediaDir: options.mediaDir,
            log: logger,
          });

      markdown = rewriteMarkdownMediaLinks(markdown, downloadResult.replacements);
      if (downloadResult.downloadedImages > 0 || downloadResult.downloadedVideos > 0) {
        logger.info(
          `Downloaded ${downloadResult.downloadedImages} images and ${downloadResult.downloadedVideos} videos`,
        );
      }
    }

    const payload: SuccessfulConvertOutput = {
      adapter: document.adapter ?? adapter.name,
      status: "ok",
      media,
      downloads: downloadResult,
      document,
      markdown,
    };

    if (options.output) {
      await writeOutput(options.output, formatOutputContent(options.format, payload));
      logger.info(`Saved ${options.format} to ${options.output}`);
    }

    if (options.debugDir) {
      await writeDebugArtifacts(options.debugDir, document, markdown, runtime.browser, runtime.network);
      logger.info(`Wrote debug artifacts to ${options.debugDir}`);
    }

    if (options.quiet) {
      return;
    }

    if (options.format === "json") {
      printOutput(formatOutputContent(options.format, payload));
      return;
    }

    printOutput(markdown);
  } finally {
    await closeRuntime(runtime);
  }
}
