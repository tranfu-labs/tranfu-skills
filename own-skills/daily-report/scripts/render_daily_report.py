#!/usr/bin/env python3
"""Render TranFu AI daily report HTML and screenshot images."""

from __future__ import annotations

import argparse
import base64
import html
import json
import shutil
import subprocess
import sys
from pathlib import Path


WIDTH = 1080
HEIGHT = 1440
DEFAULT_STYLE = "research"
DEFAULT_PALETTE = "iceblue"

SECTION_ICONS = {
    "workflow": "▦",
    "enterprise": "▣",
    "security": "◇",
    "benchmark": "⌁",
    "observability": "◌",
    "model": "△",
    "capital": "▥",
    "chain": "⟡",
    "risk": "!",
    "chip": "▣",
    "apps": "▦",
    "data": "◈",
}

COMPANY_BADGES = [
    ("OpenAI", ["openai", "gpt", "chatgpt"]),
    ("Google", ["google", "gemini", "谷歌"]),
    ("Microsoft", ["microsoft", "copilot", "windows", "azure", "微软"]),
    ("Meta", ["meta", "llama"]),
    ("TSMC", ["tsmc", "台积电"]),
    ("NVIDIA", ["nvidia", "英伟达", "gpu"]),
    ("Okta", ["okta"]),
    ("SimplAI", ["simplai"]),
    ("Tako AI", ["tako"]),
    ("Busted", ["busted", "ebpf"]),
    ("Agent Runner", ["agent runner", "harness"]),
    ("Auditi", ["auditi"]),
    ("YC", ["hacker news", "show hn", "y combinator", "ycombinator"]),
]

HIGH_SIGNAL_BADGES = {"OpenAI", "Google", "Microsoft", "Meta", "TSMC", "NVIDIA", "Okta", "YC"}

PALETTES = {
    "iceblue": {
        "light_bg": "#eef8ff",
        "light_grad": "#f8fcff 0%, #e7f5ff 100%",
        "ink": "#10263a",
        "primary": "#16456b",
        "secondary": "#29465c",
        "muted": "#5a7182",
        "chip": "#d9f0ff",
        "chip_border": "#b2d9f0",
        "dark_bg": "#0a1420",
        "dark_grad": "#0a1420 0%, #122f49 55%, #07101a 100%",
        "dark_accent": "#8ab6ff",
        "dark_accent_2": "#b8d5ff",
    },
    "skyblue": {
        "light_bg": "#edf7ff",
        "light_grad": "#fbfdff 0%, #e3f3ff 100%",
        "ink": "#122a45",
        "primary": "#0f5d92",
        "secondary": "#244864",
        "muted": "#547188",
        "chip": "#d6efff",
        "chip_border": "#add5ed",
        "dark_bg": "#07182a",
        "dark_grad": "#07182a 0%, #0a3154 55%, #06111f 100%",
        "dark_accent": "#68c7ff",
        "dark_accent_2": "#9bdcff",
    },
    "steelblue": {
        "light_bg": "#f3f7fb",
        "light_grad": "#fbfcfe 0%, #eaf2fb 100%",
        "ink": "#18283a",
        "primary": "#1f4e79",
        "secondary": "#2f4660",
        "muted": "#5f7185",
        "chip": "#dbe8f7",
        "chip_border": "#b7c9dd",
        "dark_bg": "#0a1420",
        "dark_grad": "#0a1420 0%, #122f49 55%, #07101a 100%",
        "dark_accent": "#8ab6ff",
        "dark_accent_2": "#b8d5ff",
    },
    "mist": {
        "light_bg": "#f4fbff",
        "light_grad": "#ffffff 0%, #ecf8ff 100%",
        "ink": "#173042",
        "primary": "#2b6f91",
        "secondary": "#3d6579",
        "muted": "#647b88",
        "chip": "#e1f4ff",
        "chip_border": "#bfe2f2",
        "dark_bg": "#07141d",
        "dark_grad": "#07141d 0%, #12334b 58%, #071019 100%",
        "dark_accent": "#a5dfff",
        "dark_accent_2": "#d3efff",
    },
    "slate": {
        "light_bg": "#f5f8fb",
        "light_grad": "#ffffff 0%, #edf3f8 100%",
        "ink": "#1d2c3a",
        "primary": "#355f83",
        "secondary": "#3f5870",
        "muted": "#657483",
        "chip": "#e3edf7",
        "chip_border": "#c1d1e0",
        "dark_bg": "#0d1520",
        "dark_grad": "#0d1520 0%, #1a314a 58%, #080f18 100%",
        "dark_accent": "#96bcff",
        "dark_accent_2": "#ceddff",
    },
    "aqua": {
        "light_bg": "#f0fbfd",
        "light_grad": "#ffffff 0%, #e5f8fb 100%",
        "ink": "#123238",
        "primary": "#177586",
        "secondary": "#2b606b",
        "muted": "#5d7c82",
        "chip": "#d9f5f8",
        "chip_border": "#b3dde4",
        "dark_bg": "#061519",
        "dark_grad": "#061519 0%, #0e3946 58%, #051013 100%",
        "dark_accent": "#7bd7ee",
        "dark_accent_2": "#c5f3ff",
    },
}


def esc(value: object) -> str:
    return html.escape(str(value or ""), quote=True)


def date_display(value: str) -> str:
    return esc(value.replace("-", "."))


def slug(value: str) -> str:
    return "".join(ch if ch.isalnum() else "-" for ch in value.lower()).strip("-")


def truthy(value: object) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "y", "on"}


def detect_category(item: dict) -> str:
    text = f'{item.get("title", "")} {item.get("importance", "")} {item.get("category", "")}'.lower()
    if any(k in text for k in ["安全", "监控", "外发", "权限", "身份", "security", "risk"]):
        return "security"
    if any(k in text for k in ["评测", "benchmark", "runner", "harness", "编码"]):
        return "benchmark"
    if any(k in text for k in ["tracing", "evaluation", "可观测", "observability", "评估"]):
        return "observability"
    if any(k in text for k in ["saas", "企业", "身份", "okta"]):
        return "enterprise"
    if any(k in text for k in ["模型", "gpt", "gemini", "llm", "llama"]):
        return "model"
    return "workflow"


def category_label(category: str) -> str:
    return {
        "workflow": "工作流",
        "enterprise": "企业应用",
        "security": "安全治理",
        "benchmark": "能力评测",
        "observability": "可观测性",
        "model": "模型进展",
    }.get(category, "AI 动态")


def company_badge(item: dict) -> str:
    explicit = str(item.get("company") or item.get("logo") or "").strip()
    if explicit:
        return explicit[:12]
    text = f'{item.get("title", "")} {item.get("importance", "")} {item.get("source", "")}'.lower()
    for label, keys in COMPANY_BADGES:
        if any(key.lower() in text for key in keys):
            return label
    return str(item.get("source") or "AI")[:12]


def display_company_badge(item: dict) -> str:
    badge = company_badge(item)
    return badge if badge in HIGH_SIGNAL_BADGES else ""


def item_tags(item: dict, global_keywords: list[str]) -> list[str]:
    explicit = item.get("tags")
    if isinstance(explicit, list):
        tags = [str(tag) for tag in explicit if str(tag).strip()]
        return tags[:3]
    text = f'{item.get("title", "")} {item.get("importance", "")}'
    matched = [keyword for keyword in global_keywords if keyword and keyword in text]
    if matched:
        return matched[:3]
    return [category_label(detect_category(item))]


def short_text(value: object, limit: int) -> str:
    text = str(value or "").strip()
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 1)].rstrip("，。；、 ") + "…"


def public_research_text(value: object) -> str:
    text = str(value or "").strip()
    replacements = {
        "SimplAI 代表了": "这类低代码工具代表了",
        "Tako AI 聚焦 Okta 管理场景": "这类产品聚焦企业身份与权限管理场景",
        "Busted 使用": "这类安全工具使用",
        "Agent Runner 试图": "开源评测工具试图",
        "Auditi 关注": "开源可观测工具关注",
    }
    for before, after in replacements.items():
        text = text.replace(before, after)
    return text


def chinese_date(value: str) -> str:
    parts = str(value or "").split("-")
    if len(parts) == 3 and all(part.isdigit() for part in parts):
        return f"{int(parts[0])}年{int(parts[1])}月{int(parts[2])}日"
    return str(value or "")


def logo_initial(label: str) -> str:
    label = str(label or "AI").strip()
    if not label:
        return "AI"
    if label.lower().startswith("openai"):
        return "◎"
    if label.lower().startswith("google"):
        return "G"
    if label.lower().startswith("microsoft"):
        return "M"
    if label.lower().startswith("tsmc"):
        return "T"
    if label.lower().startswith("nvidia"):
        return "N"
    if label.lower() in {"yc", "hacker news"}:
        return "Y"
    return label[:2].upper()




def logo_markup(label: str) -> str:
    key = str(label or "").lower()
    if key == "microsoft":
        return '<svg class="brand-svg microsoft-logo" viewBox="0 0 23 23" aria-hidden="true"><path fill="#f25022" d="M1 1h10v10H1z"/><path fill="#7fba00" d="M12 1h10v10H12z"/><path fill="#00a4ef" d="M1 12h10v10H1z"/><path fill="#ffb900" d="M12 12h10v10H12z"/></svg>'
    if key == "openai":
        return '<svg class="brand-svg openai-logo" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="#111" stroke-width="2"/><path d="M12 4.7c2.3 1.5 4.1 3.1 5.3 5.1-.3 2.7-1.1 5-2.4 7.1-2.6.8-5.1.9-7.4.2-1.6-2.1-2.5-4.3-2.8-6.8 1.5-2.3 3.7-4.1 7.3-5.6z" fill="none" stroke="#111" stroke-width="1.35" stroke-linejoin="round"/></svg>'
    if key == "tsmc":
        return '<svg class="brand-svg tsmc-logo" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" fill="#d71920"/><text x="24" y="29" text-anchor="middle" font-size="13" font-weight="900" font-family="Arial" fill="#fff">TSMC</text></svg>'
    icon_mapping = {
        "workflow": "▦",
        "enterprise": "▣",
        "security": "◇",
        "benchmark": "⌁",
        "observability": "◌",
        "model": "△",
    }
    if key in icon_mapping:
        return icon_mapping[key]
    mapping = {
        "tranfu": "tranfu",
        "openai": "openai",
        "google": "google",
        "meta": "meta",
        "nvidia": "nvidia",
        "okta": "okta",
        "yc": "ycombinator",
        "hacker news": "ycombinator",
    }
    slug = mapping.get(key)
    if slug:
        path = Path(__file__).resolve().parent.parent / "assets" / "logos" / f"{slug}.svg"
        if path.exists():
            svg = path.read_text(encoding="utf-8")
            svg = svg.replace("<svg", '<svg class="brand-svg" aria-hidden="true"', 1)
            return svg
    return esc(logo_initial(label))


def brand_logo_markup(brand: str) -> str:
    if str(brand or "").lower() == "tranfu":
        path = Path(__file__).resolve().parent.parent / "assets" / "logos" / "tranfu.png"
        if path.exists():
            encoded = base64.b64encode(path.read_bytes()).decode("ascii")
            return f'<img class="brand-img" src="data:image/png;base64,{encoded}" alt="">'
    return logo_markup(brand or "TranFu")


def research_theme_line(ctx: dict) -> str:
    headline = str(ctx.get("headline") or "").strip()
    if headline:
        return f"今日主线：{headline}"
    theme = str(ctx.get("theme") or "").strip()
    return f"今日主线：{theme}" if theme else "今日主线：AI 关键变化速览"


def research_lead(ctx: dict) -> str:
    return str(ctx.get("main_judgement") or ctx.get("judgement") or "每天 3 分钟，看懂 AI 世界。")


def research_editorial(ctx: dict) -> str:
    items = ctx.get("items") or []
    categories = []
    for item in items:
        label = item.get("category_label")
        if label and label not in categories:
            categories.append(label)
    category_text = "、".join(categories[:4]) if categories else "工具链、治理与评测"
    return (
        f"今天入选的 {len(items)} 条线索集中在{category_text}。重点不在单点热点，"
        "而在生产级 Agent 所需的工程底座正在补齐：流程编排、权限边界、安全监控、真实评测与可观测性。"
    )

def item_summary(item: dict) -> str:
    return item.get("summary") or item.get("importance") or ""


def normalize_entities(report: dict, items: list[dict]) -> list[dict]:
    raw = report.get("entities")
    source = raw if isinstance(raw, list) and raw else []
    if not source:
        seen = set()
        for item in items:
            company = company_badge(item)
            if company and company not in seen:
                seen.add(company)
                source.append({"label": company, "logo": company})
            for tag in item.get("tags", [])[:1]:
                tag = str(tag).strip()
                if tag and tag not in seen:
                    seen.add(tag)
                    source.append({"label": tag, "logo": ""})
    entities = []
    for entity in source[:6]:
        if isinstance(entity, str):
            label = entity
            logo = entity
        else:
            label = str(entity.get("label") or entity.get("name") or "").strip()
            logo = str(entity.get("logo") or label).strip()
        if label:
            entities.append({"label": short_text(label, 16), "logo": logo})
    return entities


def normalize_core_items(report: dict, items: list[dict]) -> list[dict]:
    raw = report.get("core_items")
    source = raw if isinstance(raw, list) and raw else items[:6]
    normalized = []
    for idx, item in enumerate(source[:6], 1):
        normalized.append(
            {
                "title": short_text(item.get("title", ""), 36),
                "summary": short_text(public_research_text(item_summary(item)), 58),
                "company": item.get("category_label") or category_label(item.get("category") or detect_category(item)),
                "logo": item.get("category") or detect_category(item),
                "category": item.get("category") or detect_category(item),
            }
        )
    return normalized


def normalize_metrics(report: dict) -> list[dict]:
    metrics = report.get("metrics")
    if isinstance(metrics, list) and metrics:
        return [
            {
                "label": short_text(m.get("label", ""), 12),
                "value": short_text(m.get("value", "—"), 10),
                "note": short_text(m.get("note", ""), 10),
            }
            for m in metrics[:2]
        ]
    return [
        {"label": "AI 线索", "value": str(len(report.get("ai_items", []))) or "0", "note": "入选"},
        {"label": "工程化信号", "value": "强", "note": "主线"},
    ]


def normalize_market_items(report: dict) -> list[dict]:
    market_items = report.get("market_items")
    if isinstance(market_items, list) and market_items:
        return [
            {
                "label": short_text(item.get("label", ""), 14),
                "value": short_text(item.get("value", "—"), 10),
                "tone": item.get("tone") or ("up" if str(item.get("value", "")).startswith("+") else "flat"),
            }
            for item in market_items[:4]
        ]
    return [
        {"label": "工作流工具", "value": "工程化加速", "tone": "flat"},
        {"label": "安全治理", "value": "监控前移", "tone": "flat"},
    ]


def normalize_brief_sections(report: dict, items: list[dict]) -> list[dict]:
    raw = report.get("brief_sections")
    if isinstance(raw, list) and raw:
        return [
            {
                "title": item.get("title", ""),
                "icon": item.get("icon") or "▣",
                "items": [str(x) for x in item.get("items", [])[:4]],
            }
            for item in raw[:6]
        ]
    item_lines = [
        f'{item.get("category_label", "AI动态")}：{short_text(item.get("title", ""), 34)}'
        for item in items[:4]
    ]
    tech_lines = [
        "Agent：从模型演示转向工程化落地，可部署、可审计、可评测成为主线。",
        "评测：真实运行环境与编码能力评测继续补齐落地短板。",
        "观测：LLM tracing 与 evaluation 仍是生产级 Agent 基础设施。",
    ]
    capital_lines = [
        "一级市场：本次素材无可验证融资事件，不展示融资额。",
        "二级市场：本次素材无可验证指数数据，不编造涨跌。",
        "代表性方向：Agent 工程化、安全治理、评测工具链仍值得跟踪。",
    ]
    policy_lines = [
        "监管动态：本次素材无可验证新增监管事件。",
        "安全议题：Agent 数据外发监控提示企业级治理需求。",
        "合规边界：身份、权限和数据流转场景需要更强审计能力。",
    ]
    chain_lines = [
        "算力层：本次素材无新增算力供需数据，维持观察。",
        "模型层：多模态、长上下文与真实任务表现仍是竞争焦点。",
        "应用层：Agent 向办公、开发、安全和企业流程渗透。",
    ]
    invest_lines = [
        "模型与工具链：基础模型、推理优化、开发工具和平台型公司。",
        "垂直应用与Agent：企业服务、开发、教育、自动化流程。",
        "数据与安全：数据治理、隐私计算、AI 安全和合规审计。",
    ]
    return [
        {"title": "一、今日要闻速览", "icon": "▤", "items": item_lines},
        {"title": "二、技术突破与产品进展", "icon": "⌁", "items": tech_lines},
        {"title": "三、资本市场与投融资", "icon": "▥", "items": capital_lines},
        {"title": "四、政策与监管动态", "icon": "◇", "items": policy_lines},
        {"title": "五、产业链影响与趋势", "icon": "⟡", "items": chain_lines},
        {"title": "六、投资方向与关注标的", "icon": "◎", "items": invest_lines},
    ]


def derive_chain(report: dict, items: list[dict]) -> list[dict]:
    raw = report.get("industry_chain")
    if isinstance(raw, list) and raw:
        return [
            {
                "label": short_text(item.get("label", ""), 8),
                "summary": short_text(item.get("summary", ""), 28),
                "icon": item.get("icon") or "chain",
            }
            for item in raw[:3]
        ]
    text = " ".join(f'{item.get("title", "")} {item.get("importance", "")}' for item in items)
    return [
        {
            "label": "算力层",
            "summary": "高端算力与基础设施仍是 AI 应用扩张底座。",
            "icon": "chip",
        },
        {
            "label": "模型层",
            "summary": "多模态、长上下文与推理效率继续成为竞争焦点。",
            "icon": "model",
        },
        {
            "label": "应用层",
            "summary": "Agent 正从演示走向企业工作流和真实开发环境。",
            "icon": "apps",
        }
        if "agent" in text.lower()
        else {
            "label": "应用层",
            "summary": "AI 应用在办公、开发、客服和行业场景中继续扩散。",
            "icon": "apps",
        },
    ]


def normalize_investment_path(report: dict) -> list[dict]:
    raw = report.get("investment_path")
    if isinstance(raw, list) and raw:
        return [
            {
                "label": short_text(item.get("label", ""), 12),
                "summary": short_text(item.get("summary", ""), 42),
                "icon": item.get("icon") or "target",
                "details": [short_text(x, 36) for x in item.get("details", [])[:3]] if isinstance(item.get("details"), list) else [],
            }
            for item in raw[:4]
        ]
    return [
        {"label": "算力基础设施", "summary": "AI芯片/服务器/存储/先进封装", "icon": "chip", "details": []},
        {"label": "模型与工具链", "summary": "基础模型/推理优化/开发平台", "icon": "model", "details": []},
        {"label": "垂直应用与Agent", "summary": "企业服务/开发/医疗/教育", "icon": "apps", "details": []},
        {"label": "数据与安全", "summary": "数据治理/隐私计算/AI安全", "icon": "security", "details": []},
    ]


def normalize_risks(report: dict) -> list[str]:
    raw = report.get("risk_items")
    if isinstance(raw, list) and raw:
        return [short_text(item, 16) for item in raw[:5]]
    return ["技术迭代不及预期", "政策监管趋严", "宏观波动加剧", "商业化落地不确定", "市场竞争加剧"]


def normalize_market_sections(report: dict) -> list[dict]:
    raw = report.get("market_sections")
    if isinstance(raw, list) and raw:
        return [
            {
                "title": short_text(section.get("title", ""), 12),
                "items": [short_text(item, 42) for item in section.get("items", [])[:5]],
            }
            for section in raw[:3]
        ]
    metrics = normalize_metrics(report)
    markets = normalize_market_items(report)
    return [
        {
            "title": "投融资",
            "items": [f"{m['label']}：{m['value']}（{m.get('note', '')}）" for m in metrics],
        },
        {
            "title": "二级市场",
            "items": [f"{item['label']} {item['value']}" for item in markets],
        },
        {
            "title": "热门赛道",
            "items": [str(x) for x in (report.get("hot_tracks") or ["AI应用/Agent", "企业服务", "医疗AI", "具身智能"])[:4]],
        },
    ]


def normalize_chain_sections(report: dict, items: list[dict]) -> list[dict]:
    raw = derive_chain(report, items)
    return [
        {
            "label": item["label"],
            "summary": short_text(item["summary"], 44),
            "icon": item.get("icon", "chain"),
            "details": [short_text(x, 38) for x in item.get("details", [])[:3]] if isinstance(item.get("details"), list) else [],
        }
        for item in raw[:3]
    ]

def dashboard_context(report: dict) -> dict:
    c = context(report)
    items = c["items"]
    return {
        **c,
        "title": report.get("dashboard_title") or "AI行业日报",
        "subtitle": report.get("subtitle") or "聚焦全球AI前沿动态、资本动向与产业趋势",
        "date_cn": chinese_date(c["date"]),
        "data_as_of": report.get("data_as_of") or c["date"],
        "core_items": normalize_core_items(report, items),
        "metrics": normalize_metrics(report),
        "market_items": normalize_market_items(report),
        "hot_tracks": [str(x) for x in (report.get("hot_tracks") or ["AI应用/Agent", "企业服务", "开发工具", "AI安全"])[:4]],
        "market_sections": normalize_market_sections(report),
        "brief_sections": normalize_brief_sections(report, items),
        "industry_chain": derive_chain(report, items),
        "chain_sections": normalize_chain_sections(report, items),
        "investment_path": normalize_investment_path(report),
        "risk_items": normalize_risks(report),
        "conclusion": report.get("conclusion") or report.get("closing") or report.get("main_judgement") or c["judgement"],
    }


def find_chrome(explicit: str | None = None) -> str | None:
    candidates = []
    if explicit:
        candidates.append(explicit)
    candidates.extend(
        [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
            "google-chrome",
            "google-chrome-stable",
            "chromium",
            "chromium-browser",
        ]
    )
    for candidate in candidates:
        if "/" in candidate:
            if Path(candidate).exists():
                return candidate
        else:
            resolved = shutil.which(candidate)
            if resolved:
                return resolved
    return None


def clean_items(items: list[dict]) -> list[dict]:
    cleaned = []
    for item in items[:5]:
        category = item.get("category") or detect_category(item)
        cleaned.append(
            {
                "rank": item.get("rank") or len(cleaned) + 1,
                "title": item.get("title", ""),
                "importance": item.get("importance", ""),
                "source": item.get("source", ""),
                "category": category,
                "category_label": item.get("category_label") or category_label(category),
                "icon": item.get("icon") or SECTION_ICONS.get(category, "•"),
                "company": company_badge(item),
                "display_company": display_company_badge(item),
                "tags": item.get("tags", []),
            }
        )
    return cleaned


def context(report: dict) -> dict:
    items = clean_items(report.get("ai_items", []))
    keywords = [str(k) for k in report.get("keywords", [])[:8]]
    for item in items:
        item["tags"] = item_tags(item, keywords)
        item["logo"] = item.get("logo") or item["company"]
    source_names = sorted({str(i.get("source", "")) for i in items if i.get("source")})
    headline = report.get("headline") or "Agent 竞争正在从演示转向生产系统"
    show_qr = bool(report.get("show_qr")) or truthy(report.get("qr_enabled", ""))
    entities = normalize_entities(report, items)
    return {
        "brand": report.get("brand") or "TranFu",
        "subtitle": report.get("brand_subtitle") or "AI RESEARCH NOTE",
        "date": report.get("date") or "",
        "confidence": report.get("confidence") or "日报",
        "headline": headline,
        "headline_accent": report.get("headline_accent") or "",
        "dek": report.get("dek") or "今天没有足以改写方向的大新闻，但开发者讨论释放出明确趋势：Agent 落地需要工作流、权限、安全、评测和可观测性。",
        "theme": report.get("theme") or "Agent 工程化余波",
        "editorial": report.get("editorial_summary") or "",
        "judgement": report.get("main_judgement") or "",
        "keywords": keywords,
        "items": items,
        "entities": entities,
        "source_label": "、".join(source_names) if source_names else "公开来源",
        "qr_label": report.get("qr_label") or "关注入口",
        "qr_placeholder": report.get("qr_placeholder") or "QR",
        "show_qr": show_qr,
        "risk_note": report.get("risk_note") or "风险提示：技术迭代不及预期、政策监管趋严、宏观波动与市场竞争均可能影响产业节奏。",
    }


def headline_html(ctx: dict) -> str:
    headline = ctx["headline"]
    accent = ctx["headline_accent"]
    if accent:
        return esc(headline).replace(esc(accent), f'<span class="accent">{esc(accent)}</span>', 1)
    return esc(headline)





def render_dashboard(report: dict, palette_name: str) -> str:
    c = dashboard_context(report)
    brief_html = "\n".join(
        f"""<section class="brief-section">
          <h2><span>{esc(section['icon'])}</span>{esc(section['title'])}</h2>
          <ul>{''.join(f'<li>{esc(line)}</li>' for line in section['items'])}</ul>
        </section>"""
        for section in c["brief_sections"]
    )
    core_html = "\n".join(
        f"""<div class="core-row">
          <div class="logo-badge">{logo_markup(item['logo'])}</div>
          <div><h3>{esc(item['title'])}</h3><p>{esc(item['summary'])}</p></div>
        </div>"""
        for item in c["core_items"]
    )
    market_section_html = "\n".join(
        f"""<section class="market-section"><h3>{esc(section['title'])}</h3><ul>{''.join(f'<li>{esc(item)}</li>' for item in section['items'])}</ul></section>"""
        for section in c["market_sections"]
    )
    chain_html = "\n".join(
        f"""<div class="chain-row">
          <div class="chain-icon">{esc(SECTION_ICONS.get(item['icon'], '▦'))}</div>
          <div><b>{esc(item['label'])}</b><p>{esc(item['summary'])}</p>{''.join(f'<small>{esc(detail)}</small>' for detail in item.get('details', []))}</div>
        </div>"""
        for item in c["chain_sections"]
    )
    invest_html = "\n".join(
        f"""<div class="invest-card">
          <div class="invest-head"><span>{esc(SECTION_ICONS.get(item['icon'], '◇'))}</span><h3>{esc(item['label'])}</h3></div>
          <p>{esc(item['summary'])}</p>
          <ul>{''.join(f'<li>{esc(detail)}</li>' for detail in item.get('details', []))}</ul>
        </div>"""
        for item in c["investment_path"]
    )
    risks_html = "\n".join(f"<li>{esc(item)}</li>" for item in c["risk_items"])
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=1080, initial-scale=1">
  <title>{esc(c['title'])} · {esc(c['date_cn'])}</title>
  <style>
    * {{ box-sizing: border-box; }}
    html, body {{ margin: 0; width: 1080px; min-height: 1440px; background: #fff; color: #101923; font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif; letter-spacing: 0; }}
    .canvas {{ width: 1080px; height: 1440px; padding: 20px 32px 16px; background: #fff; }}
    .top-title {{ font-size: 32px; line-height: 1; font-weight: 950; color: #05070a; }}
    .top-subtitle {{ margin-top: 8px; color: #073f88; font-size: 17px; line-height: 1.2; font-weight: 850; }}
    .rule {{ height: 3px; background: #083b79; margin: 9px 0 12px; }}
    .brief-grid {{ display: grid; grid-template-columns: 1fr 1fr; column-gap: 46px; row-gap: 12px; }}
    .brief-section h2 {{ display: flex; align-items: center; gap: 8px; margin: 0 0 8px; color: #073f88; font-size: 18px; line-height: 1.15; font-weight: 950; }}
    .brief-section h2 span {{ display: grid; place-items: center; width: 22px; height: 22px; color: #0b579d; font-size: 17px; }}
    .brief-section ul {{ margin: 0; padding-left: 17px; }}
    .brief-section li {{ margin: 0 0 3px; color: #111820; font-size: 12.5px; line-height: 1.27; font-weight: 650; }}
    .summary-box {{ margin-top: 11px; padding: 8px 18px; border: 1px solid #dde9f5; background: #f5f9ff; box-shadow: 0 3px 10px rgba(10, 68, 132, .06); }}
    .summary-box h2 {{ margin: 0 0 5px; display: flex; gap: 8px; align-items: center; color: #073f88; font-size: 16px; font-weight: 950; }}
    .summary-box p {{ margin: 0; color: #182738; font-size: 12.5px; line-height: 1.34; font-weight: 650; }}
    .meta-line {{ display: grid; grid-template-columns: 1fr auto; gap: 20px; margin-top: 6px; color: #1f2b37; font-size: 11.5px; font-weight: 750; }}
    .dashboard {{ margin-top: 7px; padding: 12px 30px 0; border: 3px solid #0b4b92; background: linear-gradient(135deg, #ffffff 0%, #f6faff 100%); position: relative; overflow: hidden; min-height: 680px; }}
    .dashboard::after {{ content: ""; position: absolute; right: -28px; top: -18px; width: 150px; height: 150px; background: linear-gradient(135deg, rgba(11,75,146,.08), transparent); transform: rotate(22deg); }}
    .dash-head {{ position: relative; z-index: 1; margin-bottom: 9px; }}
    .dash-title {{ color: #073f88; font-size: 31px; line-height: 1; font-weight: 950; }}
    .dash-subtitle {{ margin-top: 6px; color: #0b4b92; font-size: 15px; line-height: 1.15; font-weight: 900; }}
    .dash-grid {{ position: relative; z-index: 1; display: grid; grid-template-columns: 1.05fr 1.55fr 1.1fr; gap: 14px; min-height: 260px; }}
    .panel {{ border: 1px solid #d3dfed; background: rgba(255,255,255,.96); border-radius: 4px; overflow: hidden; box-shadow: 0 8px 18px rgba(25, 83, 140, .07); }}
    .panel-title {{ height: 27px; display: grid; place-items: center; background: linear-gradient(180deg, #0b5ab0, #083f87); color: #fff; font-size: 13px; font-weight: 950; }}
    .panel-body {{ padding: 10px 12px; }}
    .core-row {{ display: grid; grid-template-columns: 32px 1fr; gap: 8px; align-items: center; min-height: 40px; border-bottom: 1px solid #e5edf6; }}
    .core-row:last-child {{ border-bottom: 0; }}
    .logo-badge {{ display: grid; place-items: center; width: 28px; height: 28px; color: #073f88; border: 1px solid #d8e5f4; background: #fff; font-size: 15px; font-weight: 950; overflow: hidden; }}
    .brand-svg {{ width: 21px; height: 21px; fill: currentColor; }}
    .core-row h3 {{ margin: 0 0 1px; color: #0c2645; font-size: 10px; line-height: 1.13; font-weight: 950; }}
    .core-row p {{ margin: 0; color: #596b7d; font-size: 8px; line-height: 1.18; font-weight: 700; }}
    .market-body {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }}
    .market-section {{ min-height: 210px; border: 1px solid #dce6f1; background: #fbfdff; padding: 8px 9px; }}
    .market-section h3 {{ margin: 0 0 8px; color: #073f88; font-size: 13px; line-height: 1.1; font-weight: 950; }}
    .market-section ul {{ margin: 0; padding-left: 15px; }}
    .market-section li {{ margin: 0 0 5px; color: #24384d; font-size: 8.8px; line-height: 1.24; font-weight: 780; }}
    .chain-row {{ display: grid; grid-template-columns: 34px 1fr; gap: 8px; align-items: start; min-height: 68px; padding: 6px 0; border-bottom: 1px solid #e5edf6; }}
    .chain-row:last-child {{ border-bottom: 0; }}
    .chain-icon {{ display: grid; place-items: center; width: 30px; height: 30px; color: #073f88; border: 1px solid #d8e5f4; background: #f5f9ff; font-size: 18px; font-weight: 950; }}
    .chain-row b {{ color: #073f88; font-size: 12px; font-weight: 950; }}
    .chain-row p {{ margin: 1px 0 0; color: #4d6175; font-size: 9px; line-height: 1.24; font-weight: 740; }}
    .chain-row small {{ display: block; margin-top: 3px; color: #3a5068; font-size: 8px; line-height: 1.18; font-weight: 720; }}
    .bottom-grid {{ position: relative; z-index: 1; display: grid; grid-template-columns: 1fr 250px; gap: 14px; margin-top: 10px; }}
    .invest-flow {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 9px; padding: 10px; }}
    .invest-card {{ min-height: 86px; background: #f6f9fe; border: 1px solid #e0eaf6; padding: 7px 9px; }}
    .invest-head {{ display: flex; align-items: center; gap: 7px; margin-bottom: 5px; }}
    .invest-head span {{ display: grid; place-items: center; flex: 0 0 auto; width: 23px; height: 23px; color: #073f88; border: 1px solid #d8e5f4; background: #fff; font-size: 15px; font-weight: 950; }}
    .invest-card h3 {{ margin: 0; color: #073f88; font-size: 12px; line-height: 1.12; font-weight: 950; }}
    .invest-card p {{ margin: 0 0 5px; color: #334b63; font-size: 9px; line-height: 1.22; font-weight: 790; }}
    .invest-card ul {{ margin: 0; padding-left: 14px; color: #53677d; font-size: 8px; line-height: 1.25; font-weight: 720; }}
    .invest-card li {{ margin-bottom: 2px; }}
    .risk-list {{ margin: 0; padding: 10px 16px 8px 26px; color: #1d2f43; font-size: 12px; line-height: 1.54; font-weight: 760; }}
    .conclusion {{ margin: 10px -30px 0; min-height: 70px; display: grid; grid-template-columns: 88px 1fr; align-items: center; background: #073f88; color: #fff; }}
    .target {{ display: grid; place-items: center; height: 100%; font-size: 34px; border-right: 1px solid rgba(255,255,255,.28); }}
    .conclusion-text {{ padding: 11px 20px; font-size: 14.5px; line-height: 1.24; font-weight: 950; }}
  </style>
</head>
<body>
  <main class="canvas">
    <section class="brief">
      <div class="top-title">{esc(c['title'])} | {esc(c['date_cn'])}</div>
      <div class="top-subtitle">{esc(c['subtitle'])}</div>
      <div class="rule"></div>
      <div class="brief-grid">{brief_html}</div>
      <div class="summary-box"><h2><span>◇</span>今日结论</h2><p>{esc(short_text(c['conclusion'], 120))}</p></div>
      <div class="meta-line"><span>风险提示：技术迭代不及预期、政策监管趋严、宏观波动与市场竞争加剧。</span><span>数据截至：{esc(c['data_as_of'])}</span></div>
    </section>
    <section class="dashboard">
      <header class="dash-head"><div class="dash-title">{esc(c['title'])} | {esc(c['date_cn'])}</div><div class="dash-subtitle">技术突破与应用加速共振，算力紧张格局延续</div></header>
      <div class="dash-grid">
        <article class="panel"><div class="panel-title">01&nbsp;&nbsp;核心看点</div><div class="panel-body">{core_html}</div></article>
        <article class="panel"><div class="panel-title">02&nbsp;&nbsp;市场与资本动向</div><div class="panel-body market-body">{market_section_html}</div></article>
        <article class="panel"><div class="panel-title">03&nbsp;&nbsp;产业链影响</div><div class="panel-body">{chain_html}</div></article>
      </div>
      <div class="bottom-grid">
        <article class="panel"><div class="panel-title">04&nbsp;&nbsp;投资方向（优先级从左至右）</div><div class="invest-flow">{invest_html}</div></article>
        <article class="panel"><div class="panel-title">05&nbsp;&nbsp;风险提示</div><ul class="risk-list">{risks_html}</ul></article>
      </div>
      <section class="conclusion"><div class="target">◎</div><div class="conclusion-text">结论：{esc(c['conclusion'])}</div></section>
    </section>
  </main>
</body>
</html>
"""

def render_research(report: dict, palette_name: str) -> str:
    p = PALETTES[palette_name]
    c = context(report)
    qr_html = (
        f'<div class="qr"><span>{esc(c["qr_placeholder"])}</span><small>{esc(c["qr_label"])}</small></div>'
        if c["show_qr"]
        else ""
    )
    stories_html = "\n".join(
        f'''<article class="story">
          <div class="rank">{idx:02d}.</div>
          <div class="story-body">
            <div class="story-meta"><span class="category">{esc(item["category_label"])}</span></div>
            <h2>{esc(item["title"])}</h2>
            <p>{esc(public_research_text(item["importance"]))}</p>
          </div>
        </article>'''
        for idx, item in enumerate(c["items"], 1)
    )
    quote = report.get("quote") or "未来已经到来，只是尚未均匀分布。"
    quote_by = report.get("quote_by") or "William Gibson"
    theme_line = research_theme_line(c)
    lead_line = research_lead(c)
    editorial = research_editorial(c)
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=1080, initial-scale=1">
  <title>{esc(c["brand"])} AI Research Note · {date_display(c["date"])}</title>
  <style>
    * {{ box-sizing: border-box; }}
    html, body {{
      margin: 0; width: 1080px; min-height: 1440px; color: #13283a; background: #eaf7ff;
      font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif; letter-spacing: 0;
    }}
    .canvas {{
      width: 1080px; height: 1440px; padding: 24px 64px 28px;
      background:
        radial-gradient(circle at 18% 12%, rgba(255,255,255,.92), transparent 32%),
        linear-gradient(90deg, rgba(20, 88, 145, 0.055) 1px, transparent 1px),
        linear-gradient(rgba(20, 88, 145, 0.055) 1px, transparent 1px),
        linear-gradient(180deg, #f7fcff 0%, #e4f6ff 100%);
      background-size: auto, 40px 40px, 40px 40px, auto;
    }}
    .masthead {{ display: grid; grid-template-columns: 240px 1fr; gap: 28px; align-items: start; margin-bottom: 6px; min-height: 126px; }}
    .date {{ justify-self: start; padding: 12px 17px; border: 2px solid {p["primary"]}; background: rgba(255,255,255,.72); font-size: 24px; font-weight: 900; white-space: nowrap; }}
    .brand {{ justify-self: end; display: block; width: 260px; height: 132px; margin-right: -34px; }}
    .mark {{ width: 260px; height: 132px; display: grid; place-items: center; border: 0; background: transparent; overflow: visible; padding: 0; }}
    .mark .brand-img {{ display: block; width: 146px; height: 146px; object-fit: contain; object-position: center; mix-blend-mode: multiply; }}
    .mark .brand-svg {{ display: block; width: 146px; height: 146px; object-fit: contain; overflow: visible; }}
    .short-rule {{ width: 92px; height: 5px; margin: 0 0 13px; background: #111; }}
    .cover-title {{ margin: 0; max-width: 900px; color: #0e2537; font-family: Georgia, "Songti SC", "STSong", serif; font-size: 50px; line-height: 1.01; font-weight: 950; letter-spacing: 0; }}
    .yellow-line {{ width: 410px; height: 16px; margin: -6px 0 13px 6px; background: #9dd8ff; transform: rotate(-1.2deg); }}
    h1 {{ margin: 0; max-width: 890px; font-size: 29px; line-height: 1.1; font-weight: 950; color: #12283a; }}
    .accent {{ color: {p["primary"]}; }}
    .lead {{ max-width: 890px; margin-top: 8px; color: #435b70; font-size: 18px; line-height: 1.24; font-weight: 720; }}
    .summary {{ margin: 12px 0 10px; padding: 13px 24px; background: {p["primary"]}; color: #f6faf5; }}
    .summary-label {{ color: #d5efff; font-size: 15px; font-weight: 950; margin-bottom: 7px; }}
    .summary p {{ margin: 0; font-size: 18px; line-height: 1.32; font-weight: 780; }}
    .content {{ display: block; }}
    .stories {{ display: grid; }}
    .story {{ display: grid; grid-template-columns: 100px 1fr; gap: 20px; padding: 16px 0 16px; border-bottom: 1.5px solid rgba(17, 34, 48, .28); }}
    .story:first-child {{ padding-top: 2px; }}
    .rank {{ color: #0e2537; font-family: Georgia, "Times New Roman", serif; font-size: 45px; line-height: 1; font-weight: 950; }}
    .story-meta {{ display: flex; align-items: center; gap: 7px; margin-bottom: 5px; }}
    .category {{ display: inline-flex; align-items: center; gap: 5px; padding: 4px 8px; background: #e2f3ff; color: {p["primary"]}; border: 1px solid #bfe1f6; font-size: 13px; line-height: 1; font-weight: 950; }}
    .company {{ padding: 4px 8px; border: 1px solid #cdd8df; color: #344f64; background: rgba(255,255,255,.72); font-size: 13px; line-height: 1; font-weight: 900; }}
    .story h2 {{ margin: 0 0 7px; color: #111; font-family: Georgia, "Songti SC", "STSong", serif; font-size: 27px; line-height: 1.12; font-weight: 950; }}
    .story p {{ margin: 0; color: #52697a; font-size: 17px; line-height: 1.34; font-weight: 660; }}
    .footer {{ margin-top: 18px; display: grid; grid-template-columns: 82px 1fr; gap: 18px; align-items: center; border-top: 3px solid {p["primary"]}; padding-top: 14px; color: {p["primary"]}; font-weight: 900; }}
    .quote-mark {{ color: #111; font-family: Georgia, "Times New Roman", serif; font-size: 56px; line-height: .8; }}
    .quote {{ color: #111; font-family: Georgia, "Songti SC", "STSong", serif; font-size: 26px; line-height: 1.16; font-weight: 750; }}
    .quote small {{ display: block; margin-top: 6px; color: #333; text-align: right; font-size: 18px; font-style: italic; font-weight: 500; }}
    .qr {{ width: 150px; height: 150px; display: grid; place-items: center; border: 2px dashed {p["primary"]}; color: {p["primary"]}; font-size: 26px; background: repeating-linear-gradient(45deg, {p["chip"]} 0 8px, {p["chip_border"]} 8px 16px); }}
    .qr small {{ display: block; margin-top: -28px; font-size: 14px; }}
  </style>
</head>
<body>
  <main class="canvas">
    <section class="masthead">
      <div class="date">{date_display(c["date"])}</div>
      <div class="brand"><div class="mark">{brand_logo_markup(c["brand"])}</div></div>
    </section>
    <div class="short-rule"></div>
    <div class="cover-title">AI 圈今日大事<br>速览精选</div>
    <div class="yellow-line"></div>
    <h1>{esc(theme_line)}</h1>
    <div class="lead">{esc(lead_line)}</div>
    <section class="summary"><div class="summary-label">主编判断</div><p>{esc(editorial)}</p></section>
    <section class="content">
      <div class="stories">{stories_html}</div>
      {qr_html}
    </section>
    <footer class="footer"><div class="quote-mark">“</div><div class="quote">{esc(quote)}<small>— {esc(quote_by)}</small></div></footer>
  </main>
</body>
</html>
"""


def render_dark(report: dict, palette_name: str) -> str:
    p = PALETTES[palette_name]
    c = context(report)
    if "，" in c["headline"] and not c["headline_accent"]:
        before, after = c["headline"].rsplit("，", 1)
        h = f'{esc(before)}，<span class="accent">{esc(after)}</span>'
    else:
        h = headline_html(c)
    qr_panel = (
        f'<aside class="qr-card"><div class="qr-title">{esc(c["qr_label"])}</div><div class="qr-box">{esc(c["qr_placeholder"])}</div></aside>'
        if c["show_qr"]
        else '<aside class="platform-card"><div>平台适配</div><p>默认不放二维码，避免小红书、X、社群转发场景被限流或裁切。</p></aside>'
    )
    category_html = "\n".join(
        f'<div class="nav-pill"><span>{esc(SECTION_ICONS.get(key, "•"))}</span>{esc(label)}</div>'
        for key, label in [
            ("workflow", "工作流"),
            ("enterprise", "企业"),
            ("security", "安全"),
            ("benchmark", "评测"),
            ("observability", "观测"),
        ]
    )
    stories_html = "\n".join(
        f"""
          <section class="story">
            <div class="rank">{idx}</div>
            <div>
              <div class="story-meta"><span class="story-icon">{esc(item["icon"])}</span><span class="category">{esc(item["category_label"])}</span></div>
              <h3>{esc(item["title"])}</h3>
              <p>{esc(public_research_text(item["importance"]))}</p>
            </div>
          </section>"""
        for idx, item in enumerate(c["items"], 1)
    )
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=1080, initial-scale=1">
  <title>{esc(c["brand"])} AI 日报 · {date_display(c["date"])}</title>
  <style>
    :root {{ --bg: {p["dark_bg"]}; --cyan: {p["dark_accent"]}; --green: {p["dark_accent_2"]}; --amber: #d6e4ff; --red: #ff7a8a; --blue: #7ab8ff; --muted: #9fb7b8; }}
    * {{ box-sizing: border-box; }}
    html, body {{ margin: 0; width: 1080px; min-height: 1440px; background: var(--bg); color: #f4fbf9; font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", Arial, sans-serif; letter-spacing: 0; }}
    body {{ display: grid; place-items: start center; }}
    .canvas {{ position: relative; width: 1080px; height: 1440px; overflow: hidden; padding: 34px 58px 28px; background: radial-gradient(circle at 17% 12%, rgba(138,182,255,.16), transparent 27%), radial-gradient(circle at 78% 21%, rgba(184,213,255,.11), transparent 24%), linear-gradient(135deg, rgba(255,255,255,.06) 0 1px, transparent 1px 72px), linear-gradient(90deg, {p["dark_grad"]}); }}
    .canvas::before {{ content: ""; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px); background-size: 36px 36px; mask-image: linear-gradient(to bottom, rgba(0,0,0,.86), transparent 82%); }}
    .canvas::after {{ content: ""; position: absolute; inset: 22px; border: 1px solid rgba(138,182,255,.24); pointer-events: none; }}
    .content {{ position: relative; z-index: 1; display: grid; grid-template-rows: auto auto auto 1fr auto; gap: 14px; height: 100%; }}
    .topbar {{ display: grid; grid-template-columns: 1fr 205px; align-items: start; gap: 28px; }}
    .brand-row {{ display: flex; align-items: center; gap: 16px; margin-bottom: 10px; }}
    .logo-mark {{ width: 62px; height: 62px; display: grid; place-items: center; border: 2px solid rgba(138,182,255,.72); background: linear-gradient(135deg, rgba(138,182,255,.24), rgba(184,213,255,.08)); color: var(--cyan); font-weight: 950; font-size: 30px; box-shadow: 0 0 26px rgba(138,182,255,.18); }}
    .brand-name {{ font-size: 41px; line-height: 1; font-weight: 950; }}
    .brand-sub {{ margin-top: 7px; color: var(--muted); font-size: 16px; text-transform: uppercase; letter-spacing: 2px; }}
    .date-chip {{ display: inline-flex; padding: 9px 14px; border: 1px solid rgba(138,182,255,.38); background: rgba(9,24,30,.78); color: var(--cyan); font-size: 20px; font-weight: 700; }}
    .headline {{ margin: 0; max-width: 720px; font-size: 45px; line-height: 1.04; font-weight: 900; }}
    .headline .accent {{ color: var(--green); }}
    .dek {{ margin-top: 12px; max-width: 770px; color: #c9dcda; font-size: 21px; line-height: 1.34; font-weight: 500; }}
    .qr-card {{ width: 205px; padding: 14px; border: 1px solid rgba(138,182,255,.42); background: rgba(7,19,26,.82); }}
    .qr-title {{ text-align: center; color: #d8f7f2; font-size: 18px; margin-bottom: 12px; font-weight: 700; }}
    .qr-box {{ height: 166px; display: grid; place-items: center; border: 1px dashed rgba(255,255,255,.34); background: repeating-linear-gradient(45deg, rgba(255,255,255,.10) 0 8px, transparent 8px 16px); color: rgba(255,255,255,.74); font-size: 22px; font-weight: 800; }}
    .platform-card {{ width: 205px; padding: 15px; border: 1px solid rgba(138,182,255,.42); background: rgba(7,19,26,.82); color: #d8f7f2; }}
    .platform-card div {{ color: var(--cyan); font-size: 19px; font-weight: 900; margin-bottom: 10px; }}
    .platform-card p {{ margin: 0; color: #bfcfdd; font-size: 15px; line-height: 1.46; font-weight: 650; }}
    .visual-nav {{ display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }}
    .nav-pill {{ display: flex; align-items: center; justify-content: center; gap: 8px; height: 45px; border: 1px solid rgba(138,182,255,.22); background: rgba(138,182,255,.08); color: #d7ecff; font-size: 16px; font-weight: 900; }}
    .nav-pill span {{ color: var(--cyan); font-size: 20px; }}
    .status-row {{ display: grid; grid-template-columns: 1.35fr .65fr; gap: 20px; }}
    .panel {{ border: 1px solid rgba(138,182,255,.34); background: linear-gradient(180deg, rgba(12,28,34,.82), rgba(6,18,24,.72)); box-shadow: 0 0 38px rgba(138,182,255,.08); }}
    .editor-note {{ padding: 16px 22px; }}
    .panel-label {{ display: flex; align-items: center; gap: 10px; color: var(--green); font-size: 17px; font-weight: 800; margin-bottom: 10px; text-transform: uppercase; }}
    .panel-label::before {{ content: ""; width: 8px; height: 8px; background: var(--green); box-shadow: 0 0 14px rgba(184,213,255,.85); }}
    .editor-note p {{ margin: 0; color: #d3e3e0; font-size: 18px; line-height: 1.34; font-weight: 520; }}
    .signal-card {{ padding: 16px 18px; display: grid; align-content: space-between; gap: 12px; }}
    .signal-title {{ color: var(--muted); font-size: 18px; font-weight: 800; }}
    .signal-value {{ color: var(--amber); font-size: 25px; line-height: 1.12; font-weight: 900; }}
    .metric-grid {{ display: grid; gap: 10px; }}
    .metric {{ display: grid; gap: 8px; }}
    .metric-head {{ display: flex; justify-content: space-between; color: #c5d9d7; font-size: 16px; font-weight: 750; }}
    .bar {{ height: 9px; overflow: hidden; background: rgba(255,255,255,.09); }}
    .bar span {{ display: block; height: 100%; background: linear-gradient(90deg, var(--cyan), var(--green)); }}
    .main-grid {{ display: grid; grid-template-columns: 1.42fr .78fr; gap: 20px; min-height: 0; }}
    .story-list {{ padding: 20px 22px; display: grid; gap: 8px; min-height: 0; }}
    .section-title {{ display: flex; align-items: center; justify-content: space-between; gap: 16px; }}
    .section-title h2 {{ margin: 0; font-size: 27px; line-height: 1.1; font-weight: 900; }}
    .section-title span {{ color: var(--muted); font-size: 16px; font-weight: 700; }}
    .story {{ display: grid; grid-template-columns: 58px 1fr; gap: 12px; min-height: 93px; padding: 9px 12px 8px 10px; border: 1px solid rgba(138,182,255,.16); background: rgba(4,15,20,.54); }}
    .rank {{ display: grid; place-items: center; width: 52px; height: 52px; border: 1px solid rgba(138,182,255,.42); color: var(--cyan); font-size: 28px; font-weight: 900; background: rgba(138,182,255,.08); }}
    .story-meta {{ display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }}
    .story-icon {{ display: grid; place-items: center; width: 26px; height: 26px; border: 1px solid rgba(138,182,255,.28); background: rgba(138,182,255,.09); color: var(--cyan); font-size: 17px; font-weight: 950; }}
    .category {{ padding: 4px 7px; background: rgba(138,182,255,.16); color: #d6ecff; border: 1px solid rgba(138,182,255,.18); font-size: 12px; font-weight: 900; }}
    .story h3 {{ margin: 0 0 4px; color: #e9fffb; font-size: 18px; line-height: 1.18; font-weight: 850; }}
    .story p {{ margin: 0; color: #bdd0ce; font-size: 14px; line-height: 1.26; }}
    .tags {{ display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }}
    .tags span {{ padding: 4px 7px; border: 1px solid rgba(138,182,255,.18); background: rgba(138,182,255,.07); color: #cfe6ff; font-size: 12px; font-weight: 850; }}
    .side-stack {{ display: grid; gap: 14px; min-height: 0; }}
    .insight-card, .source-card, .risk-card {{ padding: 17px; }}
    .insight-title {{ margin-top: 10px; color: #e8fff9; font-size: 24px; line-height: 1.12; font-weight: 900; }}
    .small-copy {{ margin: 10px 0 0; color: #c8d4cf; font-size: 15px; line-height: 1.32; }}
    .source-list {{ margin-top: 12px; display: grid; gap: 12px; }}
    .source-pill {{ display: flex; justify-content: space-between; gap: 14px; padding: 11px 12px; border: 1px solid rgba(122,184,255,.2); background: rgba(122,184,255,.07); color: #d9ecff; font-size: 17px; font-weight: 800; }}
    .source-pill span:last-child {{ color: var(--muted); font-size: 15px; }}
    .risk-copy {{ margin: 0; color: #c4d5d7; font-size: 14px; line-height: 1.34; font-weight: 620; }}
    .footer {{ display: grid; grid-template-columns: 1fr auto; gap: 22px; align-items: end; border-top: 1px solid rgba(138,182,255,.18); padding-top: 10px; }}
    .closing {{ color: #d7ebe7; font-size: 16px; line-height: 1.24; font-weight: 720; }}
    .footer-brand {{ color: var(--cyan); font-size: 22px; font-weight: 900; letter-spacing: 3px; white-space: nowrap; }}
  </style>
</head>
<body>
  <main class="canvas">
    <div class="content">
      <header class="topbar"><section><div class="brand-row"><div class="logo-mark">{esc(c["brand"][0].upper())}</div><div><div class="brand-name">{esc(c["brand"])}</div><div class="brand-sub">AI DAILY INTELLIGENCE</div></div></div><div class="date-chip">{date_display(c["date"])} · {esc(c["confidence"])}</div><h1 class="headline">{h}</h1><div class="dek">{esc(c["dek"])}</div></section>{qr_panel}</header>
      <section class="visual-nav">{category_html}</section>
      <section class="status-row"><article class="panel editor-note"><div class="panel-label">主编总结</div><p>{esc(c["editorial"])}</p></article><aside class="panel signal-card"><div><div class="signal-title">今日主线</div><div class="signal-value">{esc(c["theme"])}</div></div><div class="metric-grid"><div class="metric"><div class="metric-head"><span>AI 可用线索</span><span>{len(c["items"])}</span></div><div class="bar"><span style="width: 68%"></span></div></div><div class="metric"><div class="metric-head"><span>工程化信号</span><span>强</span></div><div class="bar"><span style="width: 72%"></span></div></div><div class="metric"><div class="metric-head"><span>日报置信度</span><span>{esc(c["confidence"].replace("简报", ""))}</span></div><div class="bar"><span style="width: 38%; background: linear-gradient(90deg, var(--amber), var(--red))"></span></div></div></div></aside></section>
      <section class="main-grid"><article class="panel story-list"><div class="section-title"><h2>AI 最值得关注的 {len(c["items"])} 条</h2><span>来源集中于 {esc(c["source_label"])}</span></div>{stories_html}</article><aside class="side-stack"><section class="panel insight-card"><div class="panel-label">今日判断</div><div class="insight-title">Agent 正在进入可部署阶段</div><p class="small-copy">今天没有强热点爆发，但开发者讨论继续指向同一件事：Agent 落地需要工作流、权限、安全、评测和可观测性。</p></section><section class="panel source-card"><div class="panel-label">信息状态</div><div class="source-list"><div class="source-pill"><span>可用 AI 线索</span><span>{len(c["items"])} 条</span></div><div class="source-pill"><span>主要来源</span><span>{esc(c["source_label"])}</span></div><div class="source-pill"><span>日报置信度</span><span>{esc(c["confidence"].replace("简报", ""))}</span></div></div></section><section class="panel risk-card"><div class="panel-label">风险提示</div><p class="risk-copy">{esc(c["risk_note"])}</p></section></aside></section>
      <footer class="footer"><div class="closing">主编一句话：{esc(c["judgement"])}</div><div class="footer-brand">{esc(c["brand"].upper())} DAILY</div></footer>
    </div>
  </main>
</body>
</html>
"""


def render_html(report: dict, style: str, palette: str) -> str:
    if style == "dashboard":
        return render_dashboard(report, palette)
    if style == "research":
        return render_research(report, palette)
    if style == "dark":
        return render_dark(report, palette)
    raise ValueError(f"Unknown style: {style}")


def screenshot(chrome: str, html_path: Path, out_path: Path) -> None:
    cmd = [
        chrome,
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        f"--window-size={WIDTH},{HEIGHT}",
        f"--screenshot={out_path}",
        html_path.resolve().as_uri(),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def render_one(report: dict, out_dir: Path, style: str, palette: str, chrome: str | None, no_screenshot: bool) -> dict:
    html_name = f"render-{style}-{palette}.html"
    image_name = f"tranfu-daily-{style}-{palette}-1080x1440.png"
    html_path = out_dir / html_name
    image_path = out_dir / image_name
    html_path.write_text(render_html(report, style, palette), encoding="utf-8")

    screenshot_status = "skipped"
    if not no_screenshot and chrome:
        screenshot(chrome, html_path, image_path)
        screenshot_status = "created"
    elif not no_screenshot:
        screenshot_status = "missing_chrome"

    return {
        "style": style,
        "palette": palette,
        "html": html_name,
        "image": image_name if image_path.exists() else None,
        "size": f"{WIDTH}x{HEIGHT}",
        "screenshot_status": screenshot_status,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="Path to report JSON")
    parser.add_argument("--out-dir", required=True, help="Output directory")
    parser.add_argument("--style", choices=["dashboard", "research", "dark"], default=DEFAULT_STYLE)
    parser.add_argument("--palette", choices=sorted(PALETTES), default=DEFAULT_PALETTE)
    parser.add_argument("--all-variants", action="store_true", help="Render every style and palette combination")
    parser.add_argument("--chrome", help="Optional Chrome/Chromium executable path")
    parser.add_argument("--no-screenshot", action="store_true", help="Only write HTML and manifest")
    args = parser.parse_args()

    input_path = Path(args.input)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    report = json.loads(input_path.read_text(encoding="utf-8"))
    report["ai_items"] = clean_items(report.get("ai_items", []))
    chrome = None if args.no_screenshot else find_chrome(args.chrome)

    variants = []
    if args.all_variants:
        for style in ["dashboard", "research", "dark"]:
            for palette in PALETTES:
                variants.append((style, palette))
    else:
        variants.append((args.style, args.palette))

    outputs = [
        render_one(report, out_dir, style, palette, chrome, args.no_screenshot)
        for style, palette in variants
    ]

    manifest = {
        "date": report.get("date"),
        "brand": report.get("brand", "TranFu"),
        "default_style": DEFAULT_STYLE,
        "default_palette": DEFAULT_PALETTE,
        "input": str(input_path),
        "outputs": outputs,
        "display_review": {
            "removed_from_image": [
                "click-only source labels",
                "raw URLs",
                "empty non-AI sections",
                "internal render workflow text",
            ]
        },
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))

    if any(o["screenshot_status"] == "missing_chrome" for o in outputs):
        print("Chrome/Chromium not found; HTML was generated but screenshots were not created.", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
