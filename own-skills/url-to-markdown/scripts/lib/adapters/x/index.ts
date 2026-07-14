import type { Adapter } from "../types";
import { assertNoAccessBlock } from "../../browser/access-blocks";
import type { ExtractedDocument } from "../../extract/document";
import { collectMediaFromDocument } from "../../media/markdown-media";
import { extractArticleDocumentFromPayload } from "./article";
import { extractStatusId, isXHost } from "./match";
import { collectXJsonPayloads, waitForInitialXPayload } from "./payloads";
import { extractSingleTweetDocumentFromPayload } from "./single";
import { extractThreadDocumentFromPayloads } from "./thread";
import { loadFullXThread } from "./thread-loader";

function extractDocumentFromPayloads(
  payloads: unknown[],
  statusId: string,
  pageUrl: string,
): ExtractedDocument | null {
  for (const payload of payloads) {
    const articleDocument = extractArticleDocumentFromPayload(payload, statusId, pageUrl, payloads);
    if (articleDocument) {
      return articleDocument;
    }
  }

  const threadDocument = extractThreadDocumentFromPayloads(payloads, statusId, pageUrl);
  if (threadDocument) {
    return threadDocument;
  }

  for (const payload of payloads) {
    const singleDocument = extractSingleTweetDocumentFromPayload(payload, statusId, pageUrl);
    if (singleDocument) {
      return singleDocument;
    }
  }

  return null;
}

export const xAdapter: Adapter = {
  name: "x",
  match(input) {
    return isXHost(input.url.hostname);
  },
  async process(context) {
    const statusId = extractStatusId(context.input.url);
    if (!statusId) {
      return {
        status: "no_document",
      };
    }

    context.log.info(`Loading ${context.input.url.toString()} with x adapter`);
    await context.browser.goto(context.input.url.toString(), context.timeoutMs);

    await assertNoAccessBlock(context.browser);

    await waitForInitialXPayload(context);
    await loadFullXThread(context, statusId);

    const pageUrl = await context.browser.getURL();
    await assertNoAccessBlock(context.browser);

    const payloads = await collectXJsonPayloads(context);
    if (payloads.length === 0) {
      return {
        status: "no_document",
      };
    }

    const document = extractDocumentFromPayloads(payloads, statusId, pageUrl);
    if (document) {
      return {
        status: "ok",
        document,
        media: collectMediaFromDocument(document),
      };
    }

    return {
      status: "no_document",
    };
  },
};
