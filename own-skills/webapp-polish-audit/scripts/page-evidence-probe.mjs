async function setViewportIfAvailable(browser, viewport) {
  if (!browser?.capabilities?.get) {
    return false;
  }

  try {
    const viewportCapability = await browser.capabilities.get("viewport");
    await viewportCapability.set(viewport);
    return true;
  } catch {
    return false;
  }
}

async function resetViewportIfAvailable(browser) {
  if (!browser?.capabilities?.get) {
    return;
  }

  try {
    const viewportCapability = await browser.capabilities.get("viewport");
    await viewportCapability.reset();
  } catch {
    // Best-effort cleanup only.
  }
}

async function settlePage(tab, url, options) {
  await tab.goto(url);
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
    // Dev apps can keep connections open.
  }
}

async function collectCurrentViewportEvidence(tab, label, options) {
  return await tab.playwright.evaluate((viewportLabel) => {
    const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const text = (element) =>
      normalizeText(element.innerText || element.textContent || element.getAttribute("aria-label") || "");
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const all = (selector) => Array.from(document.querySelectorAll(selector)).filter(visible);
    const sample = (items, limit = 16) => items.slice(0, limit);

    const cssPath = (element) => {
      if (element.id) {
        return `#${CSS.escape(element.id)}`;
      }
      const parts = [];
      let node = element;
      while (node && node.nodeType === 1 && parts.length < 4) {
        if (node.id) {
          parts.unshift(`#${CSS.escape(node.id)}`);
          break;
        }
        let part = node.tagName.toLowerCase();
        const parent = node.parentElement;
        if (parent) {
          const sameTagSiblings = Array.from(parent.children).filter(
            (sibling) => sibling.tagName === node.tagName,
          );
          if (sameTagSiblings.length > 1) {
            part += `:nth-of-type(${sameTagSiblings.indexOf(node) + 1})`;
          }
        }
        parts.unshift(part);
        node = parent;
      }
      return parts.join(" > ");
    };

    // 16-page-exploration-and-capture 元素盘点字段契约的样式向量：背景色/文字色/边框/圆角/字号/字重/内边距/行高。
    const styleVectorOf = (style) => ({
      backgroundColor: style.backgroundColor,
      color: style.color,
      border: style.border,
      borderRadius: style.borderRadius,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      padding: style.padding,
      lineHeight: style.lineHeight,
    });

    const lineHeightPx = (style) => {
      const parsed = parseFloat(style.lineHeight);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
      return (parseFloat(style.fontSize) || 16) * 1.2;
    };

    const boxOf = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        x: Math.round(rect.x + window.scrollX),
        y: Math.round(rect.y + window.scrollY),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    };

    // 只判裁切，不判换行（getClientRects 对块级控件恒为 1）。换行由 11.F 用 Range 测真实行数，不截特写。
    const overflowOf = (element) => ({
      clipX: element.scrollWidth > element.clientWidth,
      clipY: element.scrollHeight > element.clientHeight,
    });

    // 换行嫌疑：内容高度 >= 1.8 倍行高。高查全信号，定罪必须走放大视觉判定。
    const wrapSuspectOf = (element, style, textValue) => {
      if (!textValue) {
        return false;
      }
      const rect = element.getBoundingClientRect();
      const paddingY = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
      return rect.height - paddingY >= lineHeightPx(style) * 1.8;
    };

    const bodyText = normalizeText(document.body.innerText || document.body.textContent || "");
    const lowerBodyText = bodyText.toLowerCase();
    const viewport = {
      label: viewportLabel,
      width: document.documentElement.clientWidth,
      height: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };

    const headings = all("h1,h2,h3").map((element) => ({
      tag: element.tagName.toLowerCase(),
      text: text(element).slice(0, 160),
    }));

    const navItems = all('nav a[href], header a[href], [role="navigation"] a[href]').map((element) => {
      const style = getComputedStyle(element);
      return {
        href: element.getAttribute("href") || "",
        text: text(element).slice(0, 120),
        ariaCurrent: element.getAttribute("aria-current") || "",
        className: element.getAttribute("class") || "",
        selector: cssPath(element),
        box: boxOf(element),
        style: styleVectorOf(style),
      };
    });

    const controls = all(
      'a[href], button, summary, [role="button"], [role="tab"], [role="combobox"], [role="menu"], [role="menuitem"], [aria-expanded], [aria-haspopup]',
    ).map((element) => {
      const style = getComputedStyle(element);
      const textValue = text(element).slice(0, 140);
      return {
        tag: element.tagName.toLowerCase(),
        role: element.getAttribute("role") || "",
        href: element.getAttribute("href") || "",
        text: textValue,
        ariaLabel: element.getAttribute("aria-label") || "",
        ariaSelected: element.getAttribute("aria-selected") || "",
        ariaExpanded: element.getAttribute("aria-expanded") || "",
        ariaCurrent: element.getAttribute("aria-current") || "",
        disabled: element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true",
        selector: cssPath(element),
        box: boxOf(element),
        style: styleVectorOf(style),
        overflow: overflowOf(element),
        wrapSuspect: wrapSuspectOf(element, style, textValue),
      };
    });

    const collections = all('article, [role="article"], table, [role="table"], [role="grid"], ul, ol')
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        role: element.getAttribute("role") || "",
        text: text(element).slice(0, 220),
        linkCount: element.querySelectorAll("a[href]").length,
      }))
      .filter((item) => item.text.length > 30 || item.linkCount > 0);

    const forms = all(
      'form, input:not([type="hidden"]), textarea, select, [contenteditable="true"], [role="textbox"], [role="searchbox"]',
    ).map((element) => ({
      tag: element.tagName.toLowerCase(),
      type: element.getAttribute("type") || "",
      role: element.getAttribute("role") || "",
      label: element.getAttribute("aria-label") || element.getAttribute("placeholder") || text(element).slice(0, 80),
    }));

    const dialogs = all('dialog, [role="dialog"], [aria-modal="true"]').map((element) => ({
      tag: element.tagName.toLowerCase(),
      role: element.getAttribute("role") || "",
      text: text(element).slice(0, 180),
    }));

    const keywords = {
      status: [
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
      ],
      asyncAction: [
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
      ],
      theme: ["theme", "dark", "light", "system", "主题", "深色", "浅色"],
    };

    const keywordHits = Object.fromEntries(
      Object.entries(keywords).map(([key, list]) => [
        key,
        list.filter((keyword) => lowerBodyText.includes(keyword.toLowerCase())),
      ]),
    );

    const selectedTabs = controls.filter((control) => control.role === "tab" && control.ariaSelected === "true");
    const expandedControls = controls.filter((control) => control.ariaExpanded === "true");

    // 关键 CTA 的操作定义（00 / 09 引用此清单）：有填充底色且处于首屏 1.5 屏内、
    // 换行嫌疑、裁切嫌疑、全页文字最长的控件。维度判定不得缩小该清单，可以追加。
    const bodyBackground = getComputedStyle(document.body).backgroundColor;
    const hasFill = (background) =>
      Boolean(background) && background !== "transparent" && !/^rgba\(.+,\s*0\)$/.test(background);
    const foldLimit = window.innerHeight * 1.5;
    const targetMap = new Map();
    const addTarget = (control, reason) => {
      const existing = targetMap.get(control.selector);
      if (existing) {
        if (!existing.reasons.includes(reason)) {
          existing.reasons.push(reason);
        }
        return;
      }
      targetMap.set(control.selector, {
        selector: control.selector,
        text: control.text.slice(0, 80),
        reasons: [reason],
        box: control.box,
      });
    };
    for (const control of controls) {
      if (!control.text) {
        continue;
      }
      if (
        hasFill(control.style.backgroundColor) &&
        control.style.backgroundColor !== bodyBackground &&
        control.box.y < foldLimit
      ) {
        addTarget(control, "primary-cta");
      }
      if (control.wrapSuspect) {
        addTarget(control, "wrap-suspect");
      }
      if (control.overflow.clipX || control.overflow.clipY) {
        addTarget(control, "clip-suspect");
      }
    }
    const longestLabel = controls
      .filter((control) => control.text)
      .sort((a, b) => b.text.length - a.text.length)[0];
    if (longestLabel) {
      addTarget(longestLabel, "longest-label");
    }
    const suspectTargets = Array.from(targetMap.values()).slice(0, 12);

    return {
      url: location.href,
      title: document.title || "",
      viewport,
      counts: {
        headings: headings.length,
        navItems: navItems.length,
        controls: controls.length,
        collections: collections.length,
        forms: forms.length,
        dialogs: dialogs.length,
      },
      suspectTargets,
      samples: {
        headings: sample(headings, 20),
        navItems: sample(navItems, 20),
        controls: sample(controls, 30),
        collections: sample(collections, 18),
        forms: sample(forms, 10),
        dialogs: sample(dialogs, 5),
        selectedTabs,
        expandedControls: sample(expandedControls, 10),
        keywordHits,
      },
    };
  }, label, { timeoutMs: options.evaluateTimeoutMs });
}

export async function collectPageEvidence(browser, tab, inputOptions = {}) {
  const options = {
    url: inputOptions.url,
    desktopViewport: inputOptions.desktopViewport || { width: 1280, height: 720 },
    narrowViewport: inputOptions.narrowViewport || { width: 390, height: 844 },
    navigationTimeoutMs: inputOptions.navigationTimeoutMs ?? 12000,
    networkIdleTimeoutMs: inputOptions.networkIdleTimeoutMs ?? 1500,
    evaluateTimeoutMs: inputOptions.evaluateTimeoutMs ?? 8000,
  };

  const result = {
    url: options.url,
    viewportCoverage: {
      desktop: "not checked",
      narrow: "not checked",
    },
    viewports: {},
    blockers: [],
  };

  try {
    const desktopSet = await setViewportIfAvailable(browser, options.desktopViewport);
    await settlePage(tab, options.url, options);
    result.viewports.desktop = await collectCurrentViewportEvidence(tab, "desktop", options);
    result.viewportCoverage.desktop = desktopSet
      ? `checked ${options.desktopViewport.width}x${options.desktopViewport.height}`
      : "checked current viewport";

    const narrowSet = await setViewportIfAvailable(browser, options.narrowViewport);
    await settlePage(tab, options.url, options);
    result.viewports.narrow = await collectCurrentViewportEvidence(tab, "narrow", options);
    result.viewportCoverage.narrow = narrowSet
      ? `checked ${options.narrowViewport.width}x${options.narrowViewport.height}`
      : "checked current viewport";
  } catch (error) {
    result.blockers.push(error instanceof Error ? error.message : String(error));
  } finally {
    await resetViewportIfAvailable(browser);
  }

  return result;
}
