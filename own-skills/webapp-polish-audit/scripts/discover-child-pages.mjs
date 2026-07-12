const DEFAULT_EXCLUDED_EXTENSIONS =
  /\.(?:avif|css|csv|docx?|gif|ico|jpe?g|js|json|map|mjs|mp3|mp4|otf|pdf|png|svg|tar|tgz|ttf|txt|wav|webm|webp|woff2?|xlsx?|xml|zip)$/i;

function toAbsoluteHttpUrl(input, fallbackOrigin = "http://localhost:3000") {
  const value = String(input || "").trim();

  if (!value) {
    throw new Error("discoverChildPages requires a non-empty url");
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?(?:\/|$)/i.test(value)) {
    return `http://${value}`;
  }

  if (value.startsWith("/")) {
    return new URL(value, fallbackOrigin).toString();
  }

  return new URL(`http://${value}`).toString();
}

function normalizePathname(pathname) {
  const collapsed = (pathname || "/").replace(/\/{2,}/g, "/");
  if (collapsed.length > 1 && collapsed.endsWith("/")) {
    return collapsed.slice(0, -1);
  }
  return collapsed || "/";
}

function canonicalizeUrl(url, { stripQuery }) {
  const copy = new URL(url.toString());
  copy.hash = "";
  if (stripQuery) {
    copy.search = "";
  }
  copy.pathname = normalizePathname(copy.pathname);
  return copy;
}

function isStrictChildPath(basePath, candidatePath) {
  const base = normalizePathname(basePath);
  const candidate = normalizePathname(candidatePath);

  if (base === "/") {
    return candidate !== "/";
  }

  return candidate.startsWith(`${base}/`);
}

function defaultRejectReason(candidate, seed, options) {
  if (!["http:", "https:"].includes(candidate.protocol)) {
    return "non-http";
  }

  if (candidate.origin !== seed.origin) {
    return "different-origin";
  }

  if (options.excludeExtensions.test(candidate.pathname)) {
    return "asset-like-extension";
  }

  if (!isStrictChildPath(seed.pathname, candidate.pathname)) {
    return "outside-child-scope";
  }

  return null;
}

async function readRenderedLinks(tab, url, options) {
  let finalUrl = url;
  let title = "";
  let navigationError = null;
  const warnings = [];

  try {
    await tab.goto(url);
  } catch (error) {
    warnings.push({
      stage: "goto",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    await tab.playwright.waitForLoadState({
      state: "domcontentloaded",
      timeoutMs: options.navigationTimeoutMs,
    });
  } catch (error) {
    warnings.push({
      stage: "domcontentloaded",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    await tab.playwright.waitForLoadState({
      state: "networkidle",
      timeoutMs: options.networkIdleTimeoutMs,
    });
  } catch {
    // Network-idle is a best-effort settling signal; many dev apps keep sockets open.
  }

  try {
    finalUrl = (await tab.url()) || url;
    title = (await tab.title()) || "";
  } catch (error) {
    warnings.push({
      stage: "metadata",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  let links = [];
  try {
    links = await tab.playwright.evaluate(() => {
      return Array.from(document.querySelectorAll("a[href]")).map((anchor) => ({
        href: anchor.getAttribute("href") || "",
        text: (anchor.innerText || anchor.getAttribute("aria-label") || anchor.textContent || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 160),
        rel: anchor.getAttribute("rel") || "",
        target: anchor.getAttribute("target") || "",
      }));
    }, undefined, { timeoutMs: options.evaluateTimeoutMs });
  } catch (error) {
    navigationError = error instanceof Error ? error.message : String(error);
  }

  return {
    url,
    finalUrl,
    title,
    navigationError,
    warnings,
    links,
  };
}

export async function discoverChildPages(tab, inputOptions) {
  const options = {
    url: typeof inputOptions === "string" ? inputOptions : inputOptions?.url,
    fallbackOrigin: inputOptions?.fallbackOrigin || "http://localhost:3000",
    maxDepth: inputOptions?.maxDepth ?? 4,
    maxPages: inputOptions?.maxPages ?? 120,
    stripQuery: inputOptions?.stripQuery ?? true,
    navigationTimeoutMs: inputOptions?.navigationTimeoutMs ?? 12000,
    networkIdleTimeoutMs: inputOptions?.networkIdleTimeoutMs ?? 1500,
    evaluateTimeoutMs: inputOptions?.evaluateTimeoutMs ?? 5000,
    excludeExtensions: inputOptions?.excludeExtensions || DEFAULT_EXCLUDED_EXTENSIONS,
  };

  const seed = canonicalizeUrl(new URL(toAbsoluteHttpUrl(options.url, options.fallbackOrigin)), options);
  const queue = [{ url: seed.toString(), depth: 0, sourceUrl: null, sourceText: "" }];
  const queued = new Set(queue.map((item) => item.url));
  const visited = new Set();
  const discovered = new Map();
  const pages = [];
  const skipped = [];
  let stoppedReason = null;

  while (queue.length > 0) {
    if (visited.size >= options.maxPages) {
      stoppedReason = "maxPages";
      break;
    }

    const current = queue.shift();
    queued.delete(current.url);

    if (visited.has(current.url)) {
      continue;
    }

    visited.add(current.url);

    const rendered = await readRenderedLinks(tab, current.url, options);
    const pageRecord = {
      url: current.url,
      finalUrl: rendered.finalUrl,
      title: rendered.title,
      depth: current.depth,
      sourceUrl: current.sourceUrl,
      navigationError: rendered.navigationError,
      warnings: rendered.warnings,
      outgoingChildUrls: [],
      outgoingLinkCount: rendered.links.length,
    };

    pages.push(pageRecord);

    if (rendered.navigationError || current.depth >= options.maxDepth) {
      continue;
    }

    for (const link of rendered.links) {
      let candidate;
      try {
        candidate = canonicalizeUrl(new URL(link.href, rendered.finalUrl), options);
      } catch {
        skipped.push({
          href: link.href,
          sourceUrl: current.url,
          reason: "invalid-url",
        });
        continue;
      }

      const reason = defaultRejectReason(candidate, seed, options);
      const candidateUrl = candidate.toString();

      if (reason) {
        skipped.push({
          href: link.href,
          normalizedUrl: candidateUrl,
          sourceUrl: current.url,
          reason,
        });
        continue;
      }

      pageRecord.outgoingChildUrls.push(candidateUrl);

      if (!discovered.has(candidateUrl)) {
        discovered.set(candidateUrl, {
          url: candidateUrl,
          path: normalizePathname(candidate.pathname),
          depth: current.depth + 1,
          firstSeenFrom: current.url,
          firstSeenText: link.text,
        });
      }

      if (!visited.has(candidateUrl) && !queued.has(candidateUrl)) {
        queue.push({
          url: candidateUrl,
          depth: current.depth + 1,
          sourceUrl: current.url,
          sourceText: link.text,
        });
        queued.add(candidateUrl);
      }
    }
  }

  return {
    seedUrl: seed.toString(),
    scope: {
      origin: seed.origin,
      basePath: normalizePathname(seed.pathname),
      childPathRule:
        normalizePathname(seed.pathname) === "/"
          ? "same-origin path must not be /"
          : `same-origin path must start with ${normalizePathname(seed.pathname)}/`,
    },
    limits: {
      maxDepth: options.maxDepth,
      maxPages: options.maxPages,
      stripQuery: options.stripQuery,
    },
    stoppedReason,
    discoveredChildPages: Array.from(discovered.values()).sort((a, b) => a.url.localeCompare(b.url)),
    visitedPages: pages,
    skippedLinks: skipped,
  };
}
