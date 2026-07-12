const REFERENCES = {
  iconEntry: "references/dimensions/01-icon-entry-craft.md",
  theme: "references/dimensions/02-theme-experience-equivalence.md",
  interaction: "references/dimensions/03-interaction-feedback-and-safety.md",
  spatial: "references/dimensions/04-spatial-stability-and-control.md",
  dataState: "references/dimensions/05-data-state-continuity.md",
  batchInfo: "references/dimensions/06-batch-information-judgment-efficiency.md",
  form: "references/dimensions/07-form-completion-confidence.md",
  orientation: "references/dimensions/08-orientation-and-returnability.md",
  visualTrust: "references/dimensions/09-visual-trust-and-consistency.md",
  inputContinuity: "references/dimensions/10-input-and-perception-continuity.md",
  responsive: "references/dimensions/11-responsive-task-continuity.md",
  resultFeedback: "references/dimensions/12-result-feedback-and-motion-proportion.md",
  copyClarity: "references/dimensions/13-state-and-action-copy-clarity.md",
};

async function settlePage(tab, url, options) {
  if (url) {
    await tab.goto(url);
  }

  await tab.playwright.waitForLoadState({
    state: "domcontentloaded",
    timeoutMs: options.navigationTimeoutMs,
  });

  try {
    await tab.playwright.waitForLoadState({
      state: "networkidle",
      timeoutMs: options.networkIdleTimeoutMs,
    });
  } catch {
    // Dev apps often keep sockets open; DOMContentLoaded is the hard requirement.
  }
}

export async function collectPageInventory(tab, inputOptions = {}) {
  const options = {
    url: inputOptions.url,
    navigationTimeoutMs: inputOptions.navigationTimeoutMs ?? 12000,
    networkIdleTimeoutMs: inputOptions.networkIdleTimeoutMs ?? 1500,
    evaluateTimeoutMs: inputOptions.evaluateTimeoutMs ?? 8000,
  };

  await settlePage(tab, options.url, options);

  return await tab.playwright.evaluate(() => {
    const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const ownText = (element) =>
      normalizeText(element.innerText || element.textContent || element.getAttribute("aria-label") || "");
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const all = (selector) => Array.from(document.querySelectorAll(selector)).filter(visible);
    const sample = (items, limit = 12) => items.slice(0, limit);
    const lowerBodyText = normalizeText(document.body.innerText || document.body.textContent || "").toLowerCase();

    const links = all("a[href]").map((anchor) => {
      let sameOrigin = false;
      let path = "";
      try {
        const url = new URL(anchor.getAttribute("href") || "", location.href);
        sameOrigin = url.origin === location.origin;
        path = url.pathname;
      } catch {
        // Invalid hrefs remain as raw evidence only.
      }

      return {
        href: anchor.getAttribute("href") || "",
        path,
        sameOrigin,
        text: ownText(anchor).slice(0, 140),
      };
    });

    const buttonLike = all(
      'button, [role="button"], input[type="button"], input[type="submit"], input[type="reset"], summary',
    ).map((element) => ({
      tag: element.tagName.toLowerCase(),
      type: element.getAttribute("type") || "",
      role: element.getAttribute("role") || "",
      text: ownText(element).slice(0, 120),
    }));

    const formControls = all(
      'form, input:not([type="hidden"]), textarea, select, [contenteditable="true"], [role="textbox"], [role="searchbox"]',
    ).map((element) => ({
      tag: element.tagName.toLowerCase(),
      type: element.getAttribute("type") || "",
      role: element.getAttribute("role") || "",
      ariaLabel: element.getAttribute("aria-label") || "",
      placeholder: element.getAttribute("placeholder") || "",
      name: element.getAttribute("name") || "",
      id: element.id || "",
      text: ownText(element).slice(0, 120),
    }));

    const customControls = all(
      '[role="combobox"], [role="listbox"], [role="menu"], [role="menuitem"], [aria-haspopup], [aria-expanded]',
    ).map((element) => ({
      tag: element.tagName.toLowerCase(),
      role: element.getAttribute("role") || "",
      ariaExpanded: element.getAttribute("aria-expanded") || "",
      ariaHasPopup: element.getAttribute("aria-haspopup") || "",
      text: ownText(element).slice(0, 120),
    }));

    const navRegions = all('nav, header, [role="navigation"]').map((element) => ({
      tag: element.tagName.toLowerCase(),
      text: ownText(element).slice(0, 180),
      linkCount: element.querySelectorAll("a[href]").length,
    }));

    const collectionItems = all('article, [role="article"], table, [role="table"], [role="grid"], ul, ol, li')
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        role: element.getAttribute("role") || "",
        text: ownText(element).slice(0, 180),
        linkCount: element.querySelectorAll("a[href]").length,
      }))
      .filter((item) => item.text.length > 20 || item.linkCount > 0);

    const headings = all("h1,h2,h3").map((element) => ({
      tag: element.tagName.toLowerCase(),
      text: ownText(element).slice(0, 140),
    }));

    const dialogs = all('dialog, [role="dialog"], [aria-modal="true"]').map((element) => ({
      tag: element.tagName.toLowerCase(),
      role: element.getAttribute("role") || "",
      text: ownText(element).slice(0, 140),
    }));

    const statusKeywords = [
      "loading",
      "加载",
      "empty",
      "暂无",
      "no results",
      "error",
      "错误",
      "failed",
      "失败",
      "retry",
      "重试",
      "permission",
      "denied",
      "无结果",
    ];
    const actionResultKeywords = [
      "save",
      "create",
      "delete",
      "copy",
      "export",
      "upload",
      "send",
      "refresh",
      "generate",
      "undo",
      "保存",
      "创建",
      "删除",
      "复制",
      "导出",
      "上传",
      "发送",
      "刷新",
      "生成",
      "撤销",
    ];
    const themeKeywords = ["theme", "dark", "light", "system", "主题", "深色", "浅色"];

    const visibleStatusKeywords = statusKeywords.filter((keyword) => lowerBodyText.includes(keyword.toLowerCase()));
    const visibleActionResultKeywords = actionResultKeywords.filter((keyword) =>
      lowerBodyText.includes(keyword.toLowerCase()),
    );
    const themeEvidence = themeKeywords.filter((keyword) => lowerBodyText.includes(keyword.toLowerCase()));

    const pathStats = links.reduce((acc, link) => {
      if (!link.sameOrigin || !link.path) {
        return acc;
      }
      const parts = link.path.split("/").filter(Boolean);
      const key = parts.length > 1 ? `/${parts[0]}/*` : link.path || "/";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const realFormTask =
      formControls.some((item) => item.tag === "form") ||
      formControls.some((item) => ["input", "textarea", "select"].includes(item.tag)) ||
      formControls.some((item) => ["textbox", "searchbox"].includes(item.role));

    const tableLike = all('table, [role="table"], [role="grid"]').length > 0;
    const repeatedCollection = collectionItems.length >= 3 || Object.values(pathStats).some((count) => count >= 5);
    const hasSameOriginDetailLinks = Object.entries(pathStats).some(([key, count]) => key.endsWith("/*") && count >= 2);
    const hasExpandable = customControls.some((item) => item.ariaExpanded) || buttonLike.some((item) => /展开|collapse|more|更多/i.test(item.text));

    return {
      url: location.href,
      title: document.title || "",
      counts: {
        headings: headings.length,
        links: links.length,
        buttons: buttonLike.length,
        formControls: formControls.length,
        customControls: customControls.length,
        navRegions: navRegions.length,
        collectionItems: collectionItems.length,
        dialogs: dialogs.length,
        tables: tableLike ? all('table, [role="table"], [role="grid"]').length : 0,
      },
      surfaces: {
        navigation: navRegions.length > 0,
        actions: links.length > 0 || buttonLike.length > 0,
        formTask: realFormTask,
        tableListCardCollection: tableLike || repeatedCollection,
        articleDetailContent: headings.length > 0 && lowerBodyText.length > 800,
        customControlComboboxMenu: customControls.length > 0,
        modalDialogDrawer: dialogs.length > 0,
        dataStateVisible: visibleStatusKeywords.length > 0,
        asyncResultAction: visibleActionResultKeywords.length > 0,
        themeSpecificControlOrAsset: themeEvidence.length > 0,
        responsiveRisk: navRegions.length > 0 || repeatedCollection || tableLike || customControls.length > 0,
        spatialStabilityRisk: hasExpandable || dialogs.length > 0,
        orientationReturnability: navRegions.length > 0 || hasSameOriginDetailLinks,
        visualTrustRisk: repeatedCollection || headings.length >= 4,
      },
      evidence: {
        headings: sample(headings, 20),
        navRegions: sample(navRegions, 5),
        links: sample(links, 25),
        buttons: sample(buttonLike, 20),
        formControls: sample(formControls, 10),
        customControls: sample(customControls, 10),
        collectionItems: sample(collectionItems, 20),
        dialogs: sample(dialogs, 5),
        sameOriginPathStats: pathStats,
        visibleStatusKeywords,
        visibleActionResultKeywords,
        themeEvidence,
      },
    };
  }, undefined, { timeoutMs: options.evaluateTimeoutMs });
}

export function selectReferenceCandidates(inventory) {
  const selected = [];
  const skipped = [];
  const add = (reference, reason) => selected.push({ reference, reason });
  const skip = (reference, reason) => skipped.push({ reference, reason });
  const surfaces = inventory.surfaces || {};

  if (surfaces.actions) {
    add(REFERENCES.interaction, "visible links/buttons/actions or action controls");
  } else {
    skip(REFERENCES.interaction, "no visible action controls detected");
  }

  if (surfaces.spatialStabilityRisk) {
    add(REFERENCES.spatial, "expandable/dialog/stateful layout risk detected");
  } else {
    skip(REFERENCES.spatial, "no visible expand/collapse, dialog, or layout state transition detected");
  }

  if (surfaces.dataStateVisible) {
    add(REFERENCES.dataState, "visible loading/empty/error/no-results/permission keywords detected");
  } else {
    skip(REFERENCES.dataState, "no visible data-state condition detected");
  }

  if (surfaces.tableListCardCollection) {
    add(REFERENCES.batchInfo, "table/list/card collection or repeated records detected");
  } else {
    skip(REFERENCES.batchInfo, "no table/list/card collection detected");
  }

  if (surfaces.formTask) {
    add(REFERENCES.form, "real form controls or form task detected");
  } else {
    skip(REFERENCES.form, "no real form-completion task detected");
  }

  if (surfaces.orientationReturnability) {
    add(REFERENCES.orientation, "navigation or same-origin list-to-detail paths detected");
  } else {
    skip(REFERENCES.orientation, "no navigation or return-path risk detected");
  }

  if (surfaces.visualTrustRisk) {
    add(REFERENCES.visualTrust, "mixed headings, repeated groups, or visual hierarchy risk detected");
  } else {
    skip(REFERENCES.visualTrust, "no strong visual consistency risk detected");
  }

  if (surfaces.customControlComboboxMenu) {
    add(REFERENCES.inputContinuity, "custom control / combobox / menu detected");
  } else {
    skip(REFERENCES.inputContinuity, "no custom input/perception control detected");
  }

  if (surfaces.responsiveRisk) {
    add(REFERENCES.responsive, "navigation, collection, table, or controls need viewport continuity check");
  } else {
    skip(REFERENCES.responsive, "no responsive task risk detected");
  }

  if (surfaces.asyncResultAction) {
    add(REFERENCES.resultFeedback, "visible async result action keywords detected");
  } else {
    skip(REFERENCES.resultFeedback, "no save/create/delete/copy/export/upload/send/refresh/generate action detected");
  }

  if (surfaces.actions || surfaces.dataStateVisible || surfaces.asyncResultAction) {
    add(REFERENCES.copyClarity, "visible action or state copy needs naming/scope clarity check");
  } else {
    skip(REFERENCES.copyClarity, "no critical action or state copy detected");
  }

  if (surfaces.themeSpecificControlOrAsset) {
    add(REFERENCES.theme, "theme-specific control, keyword, or asset detected");
  } else {
    skip(REFERENCES.theme, "no visible theme-specific control or asset detected");
  }

  skip(REFERENCES.iconEntry, "favicon/app icon/logo mark not part of page-surface inventory by default");

  return { selected, skipped };
}
