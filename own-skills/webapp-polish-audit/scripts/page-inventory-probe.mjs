// 主流程只有这五条维度。磁盘上不存在其他 dimensions md，绝不要在这里加回旧编号。
const REFERENCES = {
  interaction: "references/dimensions/03-interaction-feedback-and-safety.md",
  form: "references/dimensions/07-form-completion-confidence.md",
  inputContinuity: "references/dimensions/10-input-and-perception-continuity.md",
  responsive: "references/dimensions/11-responsive-task-continuity.md",
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
      ariaLabel: element.getAttribute("aria-label") || "",
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
    const visibleStatusKeywords = statusKeywords.filter((keyword) => lowerBodyText.includes(keyword.toLowerCase()));
    const visibleActionResultKeywords = actionResultKeywords.filter((keyword) =>
      lowerBodyText.includes(keyword.toLowerCase()),
    );

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
      // 07 只覆盖"真的要填完并提交"的表单任务。孤立的搜索框 / 语言切换 / 非提交型选择器
      // 不算——否则一个站内搜索就会拉起 07 的全部七类判定，其中大半必然 not_applicable。
      (() => {
        const isSearchOnly = (item) =>
          item.type === "search" ||
          item.role === "searchbox" ||
          /搜索|search|查找|filter 关键词/i.test(`${item.ariaLabel} ${item.placeholder} ${item.name}`);
        const fillable = formControls.filter((item) =>
          ["input", "textarea", "select"].includes(item.tag) || ["textbox", "searchbox"].includes(item.role),
        );
        const nonSearchFields = fillable.filter((item) => !isSearchOnly(item));
        const hasFormElement = formControls.some((item) => item.tag === "form");
        const hasSubmitControl = buttonLike.some(
          (item) =>
            item.type === "submit" ||
            /提交|保存|登录|注册|发送|创建|确认|更新|submit|save|sign in|log in|register|create|send/i.test(
              `${item.text} ${item.ariaLabel}`,
            ),
        );
        // 真表单任务 = 有 <form>；或有可提交控件配合至少一个非搜索字段；或多个非搜索字段同时存在。
        return hasFormElement || (hasSubmitControl && nonSearchFields.length >= 1) || nonSearchFields.length >= 2;
      })();

    const tableLike = all('table, [role="table"], [role="grid"]').length > 0;
    const repeatedCollection = collectionItems.length >= 3 || Object.values(pathStats).some((count) => count >= 5);

    // 03 / 13 的触发条件按 dimension md 的字面定义编码，不要放宽成"页面上有按钮"。
    const DESTRUCTIVE = /delete|remove|clear|discard|publish|reset|revoke|删除|移除|清空|清除|丢弃|发布|覆盖|撤销|重置/i;
    const CRITICAL_CTA = /publish|pay|checkout|delete|send|submit|grant|invite|发布|支付|付款|结算|删除|发送|提交|授权|邀请/i;
    const actionLabel = (item) => `${item.text || ""} ${item.ariaLabel || ""}`;
    const destructiveActions = buttonLike
      .filter((item) => DESTRUCTIVE.test(actionLabel(item)))
      .map((item) => actionLabel(item).trim().slice(0, 60));
    // icon-only 破坏性控件：无可见文字，靠 aria-label 或 class 暴露 trash/close 语义。
    const destructiveIconActions = buttonLike
      .filter((item) => !item.text.trim() && /trash|delete|close|remove|dismiss/i.test(item.ariaLabel))
      .map((item) => item.ariaLabel.slice(0, 60));
    const criticalCtas = buttonLike
      .filter((item) => CRITICAL_CTA.test(actionLabel(item)))
      .map((item) => actionLabel(item).trim().slice(0, 60));
    const confirmDialogs = dialogs.filter((item) =>
      /confirm|确认|确定|are you sure|不可恢复|无法撤销/i.test(JSON.stringify(item)),
    );
    const iconOnlyActions = buttonLike.filter((item) => !item.text.trim());

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
        customControlComboboxMenu: customControls.length > 0,
        modalDialogDrawer: dialogs.length > 0,
        dataStateVisible: visibleStatusKeywords.length > 0,
        asyncResultAction: visibleActionResultKeywords.length > 0,
        responsiveRisk: navRegions.length > 0 || repeatedCollection || tableLike || customControls.length > 0,
        // 03：破坏性动作，或可区分的风险 / 优先级层级。仅有普通可点元素不算。
        destructiveActionRisk: destructiveActions.length > 0 || destructiveIconActions.length > 0,
        // 10：自定义控件 / 纯图标动作 / 键盘与触摸目标风险。
        inputPerceptionRisk: customControls.length > 0 || iconOnlyActions.length > 0,
        // 13：关键 CTA 文案，或破坏性确认弹层。
        criticalCtaOrConfirmDialog: criticalCtas.length > 0 || confirmDialogs.length > 0,
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
        destructiveActions: sample(destructiveActions, 10),
        destructiveIconActions: sample(destructiveIconActions, 10),
        criticalCtas: sample(criticalCtas, 10),
        iconOnlyActionCount: iconOnlyActions.length,
      },
    };
  }, undefined, { timeoutMs: options.evaluateTimeoutMs });
}

/**
 * 维度选择的唯一实现。S2 直接采信本函数的输出，不再由 SubAgent 复述成 YAML。
 * 每条 selected 自带 evidence 字段，充当过去 md_evidence 的角色：无证据不选。
 */
export function selectReferenceCandidates(inventory) {
  const selected = [];
  const skipped = [];
  const surfaces = inventory.surfaces || {};
  const evidence = inventory.evidence || {};
  const counts = inventory.counts || {};

  const decide = (reference, triggered, reason, signal) => {
    if (triggered) {
      selected.push({ reference, reason, evidence: signal });
    } else {
      skipped.push({ reference, reason });
    }
  };

  decide(
    REFERENCES.interaction,
    surfaces.destructiveActionRisk,
    "destructive action controls detected",
    { destructiveActions: evidence.destructiveActions, destructiveIconActions: evidence.destructiveIconActions },
  );

  decide(
    REFERENCES.form,
    surfaces.formTask,
    "real form-completion task detected",
    { formControls: counts.formControls, samples: evidence.formControls },
  );

  decide(
    REFERENCES.inputContinuity,
    surfaces.inputPerceptionRisk,
    "custom control / combobox / menu / icon-only action detected",
    { customControls: counts.customControls, iconOnlyActions: evidence.iconOnlyActionCount },
  );

  decide(
    REFERENCES.responsive,
    surfaces.responsiveRisk,
    "navigation, collection, table, or controls need viewport continuity check",
    { navRegions: counts.navRegions, collectionItems: counts.collectionItems, tables: counts.tables },
  );

  decide(
    REFERENCES.copyClarity,
    surfaces.criticalCtaOrConfirmDialog,
    "critical CTA label or destructive confirm dialog detected",
    { criticalCtas: evidence.criticalCtas, dialogs: counts.dialogs },
  );

  return { selected, skipped };
}
