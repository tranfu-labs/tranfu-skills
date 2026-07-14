import type { BrowserSession } from "./session";

export type AccessBlockKind = "login" | "cloudflare" | "recaptcha" | "hcaptcha";

export interface AccessBlock {
  kind: AccessBlockKind;
  provider: string;
  reason: string;
}

export interface AccessBlockSnapshot {
  title: string;
  currentUrl: string;
  bodyText: string;
  hasPasswordInput: boolean;
  hasUsernameInput: boolean;
  hasLoginHeading: boolean;
  hasCloudflareTurnstile: boolean;
  hasCloudflareChallenge: boolean;
  hasRecaptcha: boolean;
  hasRecaptchaIframe: boolean;
  hasHcaptcha: boolean;
  hasHcaptchaIframe: boolean;
}

function isLoginUrl(rawUrl: string): boolean {
  try {
    const pathname = new URL(rawUrl).pathname;
    return /\/(?:i\/flow\/login|login|log-in|signin|sign-in)(?:\/|$)/i.test(pathname);
  } catch {
    return false;
  }
}

export function detectAccessBlockFromSnapshot(snapshot: AccessBlockSnapshot): AccessBlock | null {
  const text = snapshot.bodyText.trim().toLowerCase();
  const title = snapshot.title.toLowerCase();
  const loginPromptDominates =
    text.length <= 2_000 &&
    (snapshot.hasLoginHeading ||
      (snapshot.hasUsernameInput && /\b(?:sign in|log in|login)\b|登录|登入/.test(text)));

  if (
    snapshot.hasCloudflareTurnstile ||
    snapshot.hasCloudflareChallenge ||
    title.includes("just a moment") ||
    text.includes("verify you are human") ||
    text.includes("checking your browser before accessing") ||
    text.includes("enable javascript and cookies to continue") ||
    snapshot.currentUrl.toLowerCase().includes("/cdn-cgi/challenge-platform/")
  ) {
    return {
      kind: "cloudflare",
      provider: "cloudflare",
      reason: "Cloudflare human verification detected",
    };
  }

  if (
    snapshot.hasRecaptcha ||
    snapshot.hasRecaptchaIframe ||
    text.includes("i'm not a robot") ||
    text.includes("recaptcha")
  ) {
    return {
      kind: "recaptcha",
      provider: "google_recaptcha",
      reason: "Google reCAPTCHA verification detected",
    };
  }

  if (snapshot.hasHcaptcha || snapshot.hasHcaptchaIframe || text.includes("hcaptcha")) {
    return {
      kind: "hcaptcha",
      provider: "hcaptcha",
      reason: "hCaptcha verification detected",
    };
  }

  if (isLoginUrl(snapshot.currentUrl) || snapshot.hasPasswordInput || loginPromptDominates) {
    return {
      kind: "login",
      provider: "page",
      reason: "Login wall detected",
    };
  }

  return null;
}

export async function detectAccessBlock(browser: BrowserSession): Promise<AccessBlock | null> {
  const emptySnapshot: AccessBlockSnapshot = {
    title: "",
    currentUrl: "",
    bodyText: "",
    hasPasswordInput: false,
    hasUsernameInput: false,
    hasLoginHeading: false,
    hasCloudflareTurnstile: false,
    hasCloudflareChallenge: false,
    hasRecaptcha: false,
    hasRecaptchaIframe: false,
    hasHcaptcha: false,
    hasHcaptchaIframe: false,
  };
  const snapshot = await browser.evaluate<AccessBlockSnapshot>(`
    (() => {
      const bodyText = (document.body?.innerText ?? "").slice(0, 5000);
      const headingText = Array.from(document.querySelectorAll("h1, h2, [role=heading]"))
        .map((element) => element.textContent?.trim() ?? "")
        .join("\\n");
      return {
        title: document.title ?? "",
        currentUrl: window.location.href,
        bodyText,
        hasPasswordInput: Boolean(
          document.querySelector('input[type="password"], input[autocomplete="current-password"]')
        ),
        hasUsernameInput: Boolean(
          document.querySelector('input[name="username"], input[autocomplete="username"], input[type="email"]')
        ),
        hasLoginHeading: /^(?:sign in|log in|login|登录|登入)(?:\\s|$)/im.test(headingText),
        hasCloudflareTurnstile: Boolean(
          document.querySelector(
            '.cf-turnstile, [name="cf-turnstile-response"], iframe[src*="challenges.cloudflare.com"]'
          )
        ),
        hasCloudflareChallenge: Boolean(
          document.querySelector(
            '#challenge-running, #cf-challenge-running, .challenge-platform, [data-ray], [data-translate="checking_browser"]'
          )
        ),
        hasRecaptcha: Boolean(
          document.querySelector(
            '.g-recaptcha, textarea[name="g-recaptcha-response"], iframe[title*="reCAPTCHA"]'
          )
        ),
        hasRecaptchaIframe: Boolean(
          document.querySelector('iframe[src*="google.com/recaptcha"], iframe[src*="recaptcha/api2"]')
        ),
        hasHcaptcha: Boolean(
          document.querySelector(
            '.h-captcha, textarea[name="h-captcha-response"], iframe[title*="hCaptcha"]'
          )
        ),
        hasHcaptchaIframe: Boolean(document.querySelector('iframe[src*="hcaptcha.com"]')),
      };
    })()
  `).catch(() => emptySnapshot);

  return detectAccessBlockFromSnapshot(snapshot ?? emptySnapshot);
}

export async function assertNoAccessBlock(browser: BrowserSession): Promise<void> {
  const block = await detectAccessBlock(browser);
  if (block) {
    throw new Error(
      `${block.reason}. This build supports only pages that require no login or manual verification.`,
    );
  }
}
