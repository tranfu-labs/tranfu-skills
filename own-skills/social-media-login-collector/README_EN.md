# Social Media Login Collector

[中文](README.md) | **English**

A Codex Skill for authenticated social-media analytics collection. After the user completes login, it uses the Codex in-app browser to collect read-only analytics from WeChat Official Accounts, Xiaohongshu, Zhihu, Toutiao, and Weibo. It produces validated JSON, CSV, and Excel reports and can optionally generate files compatible with `social-media-analytics-app`.

This project does not automate login, persist authentication material, or bypass platform challenges. It cannot guarantee that a platform will never trigger risk controls. Its goal is to keep browser interaction to the minimum required for collection and stop immediately when a risk signal appears.

## Supported Platforms

| Platform | Account analytics | Content analytics | Dashboard compatibility |
|---|---|---|---|
| WeChat Official Accounts | Follower growth | Content trends | Supported |
| Xiaohongshu | Impressions and view trends | Cumulative note snapshots | Account trends only; content remains in generic reports |
| Zhihu | Work daily report | Daily work metrics | Supported |
| Toutiao | Content and follower trends | Content metrics | Supported |
| Weibo | Follower, readership, and engagement trends | Posts visible on the basic plan | Standalone workbook; never imported into SQLite |

The default range is the 30 complete calendar days ending yesterday in the `Asia/Shanghai` time zone. Users can explicitly request another range.

## Safety Boundary

- Login, QR scanning, SMS, OTP, CAPTCHA, and device confirmation are always completed by the user.
- The Skill does not read or persist cookies, tokens, authorization headers, passwords, phone numbers, browser storage, or authentication files.
- It does not call hidden APIs, replay XHR requests, construct pagination URLs, use proxies, spoof fingerprints, or bypass challenges.
- It does not publish, delete, follow, like, comment, send messages, change settings, purchase products, or start trials.
- It operates on only one platform, one account, and one tab at a time.
- It stops immediately on CAPTCHA, sliders, unusual-login prompts, rate limits, 403/429 responses, reauthentication, or unexpected cross-origin navigation. It does not refresh or retry.

See [SKILL.md](SKILL.md) for the complete rules.

## Installation

A Codex environment with Skill support and in-app browser control is required.

```bash
git clone https://github.com/BruceL017/social-media-login-collector.git \
  ~/.codex/skills/social-media-login-collector
```

Restart Codex or refresh the Skill list after cloning. Generic Excel export requires `openpyxl` from the Codex bundled Python runtime. Dashboard-compatible export also requires the target project to provide `xlsx` and `tsx`.

## Usage

Make an explicit collection request in Codex, for example:

```text
Collect the last 30 days of WeChat Official Account analytics
Collect Xiaohongshu account and note analytics
Collect analytics from all five platforms
```

Typical workflow:

1. The Skill opens or reuses the official platform backend.
2. If needed, the user completes login and explicitly confirms that login is complete.
3. The Skill confirms the account and date range, then prefers and performs at most one native export per required data module.
4. If native export is unavailable, it uses only the minimal visible-data fallback defined by the platform reference.
5. It builds the standard manifest and validates date coverage, provenance, reconciliation, and content uniqueness.
6. It emits generic reports and, when eligible, dashboard-compatible files.
7. Even after dashboard parser validation succeeds, explicit user confirmation is required before any SQLite import.

## Output

Generic mode writes to:

```text
<cwd>/output/social-collections/<run-id>/<platform>/
```

Each platform directory contains:

```text
collection.json
account-daily.csv
contents.csv
collection.xlsx
collection-report.json
```

`collection-report.json` records coverage, row counts, derived series, limitations, and file SHA-256 values. All CSV and XLSX text is protected against formula injection.

Dashboard mode writes to an isolated batch directory:

```text
<dashboard-root>/data/imports/<run-id>/
```

The builder accepts only a hash-matched `collection.json` created by the generic exporter. Before committing files, dashboard-importable root files are round-trip validated through the target project's `parseSocialFile()`; the standalone Weibo workbook uses built-in validation. The builder never starts a database import automatically.

## Data Completeness

A run is marked `success` only when:

- every date in the declared range appears exactly once;
- all platform-required metrics are non-null for every date;
- every metric has provenance and a reconciled summary;
- the content list has end-of-list or verified-empty evidence and has been deduplicated;
- no metric depends on an unverified graphical geometry estimate.

When completeness cannot be proven, the status is `partial`. When no usable data is available, the status is `failed`. Unknown values are never rewritten as zero.

## Local Validation

All tests use synthetic data in system temporary directories and do not access real accounts:

```bash
<bundled-python> scripts/self_test.py
<bundled-python> scripts/self_test.py --dashboard-root /path/to/social-media-analytics-app
node --check scripts/build_dashboard_exports.mjs
```

Use the Codex workspace dependency loader to resolve `<bundled-python>`; that runtime must provide `openpyxl`.

The current offline suite covers generic exports for all five platforms, 24 malicious or incomplete inputs, and round-trip validation through six dashboard parsers across four platforms.

## Repository Layout

```text
.
├── README.md
├── README_EN.md
├── SKILL.md
├── agents/
│   └── openai.yaml
├── scripts/
│   ├── export_collection.py
│   ├── build_dashboard_exports.mjs
│   └── self_test.py
└── references/
    ├── manifest-schema.md
    ├── dashboard-adapter.md
    ├── wechat.md
    ├── xiaohongshu.md
    ├── zhihu.md
    ├── toutiao.md
    └── weibo.md
```

## Known Limitations

- Platform pages and native export formats may change, so current page structure still needs verification before live collection.
- The current dashboard parser cannot preserve the Xiaohongshu content snapshot date and publication-time minutes correctly. Xiaohongshu content compatibility export therefore remains disabled, while generic reports retain the full content data.
- The current dashboard has no Weibo SQLite model, so Weibo output remains a standalone workbook.
- The repository contains no real account data, cookies, tokens, or private native platform exports.

This project is not an official tool of any supported platform. Users are responsible for complying with platform terms, account permissions, and applicable data-protection requirements.
