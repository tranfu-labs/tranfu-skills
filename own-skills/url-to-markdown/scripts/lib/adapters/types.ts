import type { BrowserSession } from "../browser/session";
import type { CdpClient } from "../browser/cdp-client";
import type { NetworkJournal } from "../browser/network-journal";
import type { ExtractedDocument } from "../extract/document";
import type { MediaDownloadRequest, MediaDownloadResult, MediaAsset } from "../media/types";
import type { Logger } from "../utils/logger";

export interface AdapterInput {
  url: URL;
}

export type AdapterProcessResult =
  | {
      status: "ok";
      document: ExtractedDocument;
      media?: MediaAsset[];
    }
  | {
      status: "no_document";
    };

export interface AdapterContext {
  input: AdapterInput;
  browser: BrowserSession;
  network: NetworkJournal;
  cdp: CdpClient;
  log: Logger;
  outputFormat: "markdown" | "json";
  timeoutMs: number;
  downloadMedia: boolean;
}

export interface Adapter {
  name: string;
  match(input: AdapterInput): boolean;
  downloadMedia?(request: MediaDownloadRequest): Promise<MediaDownloadResult>;
  process(context: AdapterContext): Promise<AdapterProcessResult>;
}

export type { MediaAsset };
