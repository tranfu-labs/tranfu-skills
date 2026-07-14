#!/usr/bin/env bun

import {
  runConvertCommand,
  type ConvertCommandOptions,
  type OutputFormat,
} from "./commands/convert";

export const HELP_TEXT = `
url-to-markdown - Read a URL into Markdown or JSON with Chrome CDP

Usage:
  url-to-markdown <url> [options]

Options:
  --output <file>       Save output to file
  --quiet               Do not echo captured content to stdout; requires --output
  --format <type>       Output format: markdown | json
  --json                Alias for --format json
  --adapter <name>      Force an adapter (e.g. x, generic)
  --download-media      Download adapter-reported media into ./imgs and ./videos, then rewrite markdown links
  --media-dir <dir>     Base directory for downloaded media. Defaults to the output directory
  --debug-dir <dir>     Write debug artifacts
  --cdp-url <url>       Reuse an existing Chrome DevTools endpoint
  --browser-path <path> Explicit Chrome binary path
  --chrome-profile-dir <path>
                        Chrome user data dir. Defaults to URL_TO_MARKDOWN_CHROME_PROFILE_DIR
                        or the platform data directory under url-to-markdown/chrome-profile.
  --headless            Launch a temporary headless Chrome if needed
  --timeout <ms>        Page timeout in milliseconds (default: 30000)
  --help                Show help

Examples:
  url-to-markdown https://example.com
  url-to-markdown https://example.com --format markdown --output article.md --quiet --download-media
  url-to-markdown https://example.com --format json --output article.json --quiet
  url-to-markdown https://x.com/lennysan/status/2036483059407810640 --output post.md --quiet
`.trim();

interface CliOptions extends ConvertCommandOptions {
  url?: string;
  help: boolean;
}

function normalizeOutputFormat(raw: string): OutputFormat {
  const value = raw.toLowerCase();
  if (value === "markdown" || value === "json") {
    return value;
  }

  throw new Error(`Invalid output format: ${raw}. Expected markdown or json.`);
}

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    format: "markdown",
    headless: false,
    quiet: false,
    downloadMedia: false,
    timeoutMs: 30_000,
    help: false,
  };

  const args = argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];

    if (value === "--help" || value === "-h") {
      options.help = true;
      continue;
    }
    if (value === "--format") {
      const format = args[index + 1];
      if (!format) {
        throw new Error("--format requires a value");
      }
      options.format = normalizeOutputFormat(format);
      index += 1;
      continue;
    }
    if (value === "--json") {
      options.format = "json";
      continue;
    }
    if (value === "--download-media") {
      options.downloadMedia = true;
      continue;
    }
    if (value === "--quiet") {
      options.quiet = true;
      continue;
    }
    if (value === "--headless") {
      options.headless = true;
      continue;
    }
    if (value === "--output") {
      options.output = args[index + 1];
      index += 1;
      continue;
    }
    if (value === "--adapter") {
      options.adapter = args[index + 1];
      index += 1;
      continue;
    }
    if (value === "--debug-dir") {
      options.debugDir = args[index + 1];
      index += 1;
      continue;
    }
    if (value === "--media-dir") {
      options.mediaDir = args[index + 1];
      index += 1;
      continue;
    }
    if (value === "--cdp-url") {
      options.cdpUrl = args[index + 1];
      index += 1;
      continue;
    }
    if (value === "--browser-path") {
      options.browserPath = args[index + 1];
      index += 1;
      continue;
    }
    if (value === "--chrome-profile-dir") {
      options.chromeProfileDir = args[index + 1];
      index += 1;
      continue;
    }
    if (value === "--timeout") {
      const parsed = Number(args[index + 1]);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid timeout: ${args[index + 1]}`);
      }
      options.timeoutMs = parsed;
      index += 1;
      continue;
    }
    if (value.startsWith("-")) {
      throw new Error(`Unknown option: ${value}`);
    }
    if (!options.url) {
      options.url = value;
      continue;
    }
    throw new Error(`Unexpected argument: ${value}`);
  }

  return options;
}

async function main(): Promise<void> {
  try {
    const options = parseArgs(process.argv);
    if (options.help || !options.url) {
      console.log(HELP_TEXT);
      return;
    }

    await runConvertCommand(options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  void main();
}
