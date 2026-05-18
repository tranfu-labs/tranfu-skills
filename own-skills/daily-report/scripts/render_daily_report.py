#!/usr/bin/env python3
"""Render TranFu AI daily report HTML and screenshot images."""

from __future__ import annotations

import argparse
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
        cleaned.append(
            {
                "title": item.get("title", ""),
                "importance": item.get("importance", ""),
                "source": item.get("source", ""),
            }
        )
    return cleaned


def context(report: dict) -> dict:
    items = clean_items(report.get("ai_items", []))
    source_names = sorted({str(i.get("source", "")) for i in items if i.get("source")})
    headline = report.get("headline") or "Agent 竞争正在从演示转向生产系统"
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
        "keywords": [str(k) for k in report.get("keywords", [])[:8]],
        "items": items,
        "source_label": "、".join(source_names) if source_names else "公开来源",
        "qr_label": report.get("qr_label") or "关注入口",
        "qr_placeholder": report.get("qr_placeholder") or "QR",
    }


def headline_html(ctx: dict) -> str:
    headline = ctx["headline"]
    accent = ctx["headline_accent"]
    if accent:
        return esc(headline).replace(esc(accent), f'<span class="accent">{esc(accent)}</span>', 1)
    return esc(headline)


def render_research(report: dict, palette_name: str) -> str:
    p = PALETTES[palette_name]
    c = context(report)
    keyword_html = "\n".join(f'<span class="keyword">{esc(k)}</span>' for k in c["keywords"])
    stories_html = "\n".join(
        f'<article class="story"><div class="rank">{idx}</div><div><h2>{esc(item["title"])}</h2><p>{esc(item["importance"])}</p></div></article>'
        for idx, item in enumerate(c["items"], 1)
    )
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=1080, initial-scale=1">
  <title>{esc(c["brand"])} AI Research Note · {date_display(c["date"])}</title>
  <style>
    * {{ box-sizing: border-box; }}
    html, body {{
      margin: 0; width: 1080px; min-height: 1440px; color: {p["ink"]}; background: {p["light_bg"]};
      font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif; letter-spacing: 0;
    }}
    .canvas {{
      width: 1080px; height: 1440px; padding: 44px 64px 34px;
      background:
        linear-gradient(90deg, rgba(21, 84, 88, 0.06) 1px, transparent 1px),
        linear-gradient(rgba(21, 84, 88, 0.06) 1px, transparent 1px),
        linear-gradient(180deg, {p["light_grad"]});
      background-size: 40px 40px, 40px 40px, auto;
    }}
    .top {{ display: grid; grid-template-columns: 1fr auto; align-items: start; gap: 28px; border-bottom: 3px solid {p["primary"]}; padding-bottom: 22px; }}
    .brand {{ display: flex; align-items: center; gap: 16px; margin-bottom: 30px; }}
    .mark {{ width: 56px; height: 56px; display: grid; place-items: center; border: 2px solid {p["primary"]}; color: {p["primary"]}; font-size: 28px; font-weight: 900; }}
    .brand-name {{ font-size: 41px; font-weight: 900; line-height: 1; }}
    .brand-sub {{ margin-top: 8px; color: {p["muted"]}; font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; }}
    .date {{ padding: 12px 16px; border: 2px solid {p["primary"]}; font-size: 20px; font-weight: 900; white-space: nowrap; }}
    h1 {{ margin: 0; max-width: 820px; font-size: 54px; line-height: 1.04; font-weight: 950; }}
    .accent {{ color: {p["primary"]}; }}
    .lead {{ max-width: 820px; margin-top: 18px; color: {p["secondary"]}; font-size: 24px; line-height: 1.36; font-weight: 650; }}
    .summary {{ margin: 22px 0 22px; padding: 22px 28px; background: {p["primary"]}; color: #f6faf5; }}
    .summary-label {{ color: #c9ecff; font-size: 18px; font-weight: 900; margin-bottom: 12px; }}
    .summary p {{ margin: 0; font-size: 23px; line-height: 1.38; font-weight: 760; }}
    .grid {{ display: grid; grid-template-columns: 1.28fr 0.72fr; gap: 24px; }}
    .stories {{ display: grid; gap: 8px; }}
    .story {{ display: grid; grid-template-columns: 52px 1fr; gap: 18px; padding: 12px 0; border-bottom: 1px solid rgba(18, 53, 51, 0.24); }}
    .rank {{ display: grid; place-items: center; width: 52px; height: 52px; background: {p["primary"]}; color: #fff; font-size: 27px; font-weight: 900; }}
    .story h2 {{ margin: 0 0 8px; font-size: 23px; line-height: 1.2; font-weight: 900; }}
    .story p {{ margin: 0; color: {p["muted"]}; font-size: 17px; line-height: 1.3; font-weight: 620; }}
    .side {{ display: grid; gap: 18px; align-content: start; }}
    .card {{ border: 2px solid {p["primary"]}; background: rgba(255,255,255,.54); padding: 18px; }}
    .card h3 {{ margin: 0 0 16px; font-size: 22px; font-weight: 950; }}
    .keyword {{ display: inline-block; margin: 0 8px 10px 0; padding: 9px 10px; background: {p["chip"]}; border: 1px solid {p["chip_border"]}; font-size: 16px; font-weight: 850; }}
    .big {{ color: {p["primary"]}; font-size: 31px; line-height: 1.12; font-weight: 950; }}
    .small {{ margin-top: 12px; color: {p["muted"]}; font-size: 17px; line-height: 1.42; font-weight: 650; }}
    .footer {{ margin-top: 18px; display: flex; justify-content: space-between; align-items: end; border-top: 2px solid {p["primary"]}; padding-top: 18px; color: {p["primary"]}; font-weight: 900; }}
    .qr {{ width: 150px; height: 150px; display: grid; place-items: center; border: 2px dashed {p["primary"]}; color: {p["primary"]}; font-size: 26px; background: repeating-linear-gradient(45deg, {p["chip"]} 0 8px, {p["chip_border"]} 8px 16px); }}
  </style>
</head>
<body>
  <main class="canvas">
    <section class="top">
      <div>
        <div class="brand"><div class="mark">{esc(c["brand"][0].upper())}</div><div><div class="brand-name">{esc(c["brand"])}</div><div class="brand-sub">{esc(c["subtitle"])}</div></div></div>
        <h1>{headline_html(c)}</h1>
        <div class="lead">{esc(c["dek"])}</div>
      </div>
      <div class="date">{date_display(c["date"])}</div>
    </section>
    <section class="summary"><div class="summary-label">主编判断</div><p>{esc(c["editorial"])}</p></section>
    <section class="grid">
      <div class="stories">{stories_html}</div>
      <aside class="side">
        <div class="card"><h3>今日关键词</h3>{keyword_html}</div>
        <div class="card"><h3>今日信号</h3><div class="big">可部署、可审计、可评测</div><div class="small">Agent 的价值开始从“能运行”转向“能进入生产”。</div></div>
        <div class="qr">{esc(c["qr_placeholder"])}</div>
      </aside>
    </section>
    <footer class="footer"><div>主线：{esc(c["theme"])} · 来源集中于 {esc(c["source_label"])}</div><div>{esc(c["brand"].upper())} DAILY</div></footer>
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
    keyword_html = "\n".join(f'<span class="keyword">{esc(k)}</span>' for k in c["keywords"])
    stories_html = "\n".join(
        f"""
          <section class="story">
            <div class="rank">{idx}</div>
            <div><h3>{esc(item["title"])}</h3><p>{esc(item["importance"])}</p></div>
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
    .canvas {{ position: relative; width: 1080px; height: 1440px; overflow: hidden; padding: 46px 58px 34px; background: radial-gradient(circle at 17% 12%, rgba(138,182,255,.16), transparent 27%), radial-gradient(circle at 78% 21%, rgba(184,213,255,.11), transparent 24%), linear-gradient(135deg, rgba(255,255,255,.06) 0 1px, transparent 1px 72px), linear-gradient(90deg, {p["dark_grad"]}); }}
    .canvas::before {{ content: ""; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px); background-size: 36px 36px; mask-image: linear-gradient(to bottom, rgba(0,0,0,.86), transparent 82%); }}
    .canvas::after {{ content: ""; position: absolute; inset: 22px; border: 1px solid rgba(138,182,255,.24); pointer-events: none; }}
    .content {{ position: relative; z-index: 1; display: grid; grid-template-rows: auto auto 1fr auto; gap: 18px; height: 100%; }}
    .topbar {{ display: grid; grid-template-columns: 1fr auto; align-items: start; gap: 28px; }}
    .brand-row {{ display: flex; align-items: center; gap: 16px; margin-bottom: 13px; }}
    .logo-mark {{ width: 58px; height: 58px; display: grid; place-items: center; border: 1px solid rgba(138,182,255,.58); background: linear-gradient(135deg, rgba(138,182,255,.14), rgba(184,213,255,.08)); color: var(--cyan); font-weight: 900; font-size: 27px; }}
    .brand-name {{ font-size: 40px; line-height: 1; font-weight: 900; }}
    .brand-sub {{ margin-top: 8px; color: var(--muted); font-size: 17px; text-transform: uppercase; letter-spacing: 2px; }}
    .date-chip {{ display: inline-flex; padding: 10px 16px; border: 1px solid rgba(138,182,255,.38); background: rgba(9,24,30,.78); color: var(--cyan); font-size: 21px; font-weight: 700; }}
    .headline {{ margin: 0; max-width: 720px; font-size: 48px; line-height: 1.08; font-weight: 900; }}
    .headline .accent {{ color: var(--green); }}
    .dek {{ margin-top: 14px; max-width: 770px; color: #c9dcda; font-size: 23px; line-height: 1.42; font-weight: 500; }}
    .qr-card {{ width: 205px; padding: 16px; border: 1px solid rgba(138,182,255,.42); background: rgba(7,19,26,.82); }}
    .qr-title {{ text-align: center; color: #d8f7f2; font-size: 18px; margin-bottom: 12px; font-weight: 700; }}
    .qr-box {{ height: 166px; display: grid; place-items: center; border: 1px dashed rgba(255,255,255,.34); background: repeating-linear-gradient(45deg, rgba(255,255,255,.10) 0 8px, transparent 8px 16px); color: rgba(255,255,255,.74); font-size: 22px; font-weight: 800; }}
    .status-row {{ display: grid; grid-template-columns: 1.35fr .65fr; gap: 20px; }}
    .panel {{ border: 1px solid rgba(138,182,255,.34); background: linear-gradient(180deg, rgba(12,28,34,.82), rgba(6,18,24,.72)); box-shadow: 0 0 38px rgba(138,182,255,.08); }}
    .editor-note {{ padding: 18px 24px; }}
    .panel-label {{ display: flex; align-items: center; gap: 10px; color: var(--green); font-size: 18px; font-weight: 800; margin-bottom: 12px; text-transform: uppercase; }}
    .panel-label::before {{ content: ""; width: 8px; height: 8px; background: var(--green); box-shadow: 0 0 14px rgba(184,213,255,.85); }}
    .editor-note p {{ margin: 0; color: #d3e3e0; font-size: 20px; line-height: 1.42; font-weight: 520; }}
    .signal-card {{ padding: 18px 20px; display: grid; align-content: space-between; gap: 14px; }}
    .signal-title {{ color: var(--muted); font-size: 18px; font-weight: 800; }}
    .signal-value {{ color: var(--amber); font-size: 28px; line-height: 1.18; font-weight: 900; }}
    .metric-grid {{ display: grid; gap: 10px; }}
    .metric {{ display: grid; gap: 8px; }}
    .metric-head {{ display: flex; justify-content: space-between; color: #c5d9d7; font-size: 16px; font-weight: 750; }}
    .bar {{ height: 9px; overflow: hidden; background: rgba(255,255,255,.09); }}
    .bar span {{ display: block; height: 100%; background: linear-gradient(90deg, var(--cyan), var(--green)); }}
    .main-grid {{ display: grid; grid-template-columns: 1.42fr .78fr; gap: 20px; min-height: 0; }}
    .story-list {{ padding: 24px; display: grid; gap: 10px; min-height: 0; }}
    .section-title {{ display: flex; align-items: center; justify-content: space-between; gap: 16px; }}
    .section-title h2 {{ margin: 0; font-size: 28px; line-height: 1.12; font-weight: 900; }}
    .section-title span {{ color: var(--muted); font-size: 16px; font-weight: 700; }}
    .story {{ display: grid; grid-template-columns: 64px 1fr; gap: 13px; min-height: 94px; padding: 12px 14px 11px 12px; border: 1px solid rgba(138,182,255,.16); background: rgba(4,15,20,.54); }}
    .rank {{ display: grid; place-items: center; width: 52px; height: 52px; border: 1px solid rgba(138,182,255,.42); color: var(--cyan); font-size: 28px; font-weight: 900; background: rgba(138,182,255,.08); }}
    .story h3 {{ margin: 0 0 5px; color: #e9fffb; font-size: 20px; line-height: 1.22; font-weight: 850; }}
    .story p {{ margin: 0; color: #bdd0ce; font-size: 16px; line-height: 1.34; }}
    .side-stack {{ display: grid; gap: 20px; min-height: 0; }}
    .keyword-card, .insight-card, .source-card {{ padding: 19px; }}
    .keyword-list {{ display: flex; flex-wrap: wrap; gap: 10px; margin-top: 11px; }}
    .keyword {{ padding: 8px 10px; border: 1px solid rgba(138,182,255,.2); background: rgba(138,182,255,.08); color: #d6fbf6; font-size: 15px; font-weight: 750; line-height: 1; }}
    .insight-title {{ margin-top: 12px; color: #e8fff9; font-size: 27px; line-height: 1.16; font-weight: 900; }}
    .small-copy {{ margin: 13px 0 0; color: #c8d4cf; font-size: 17px; line-height: 1.4; }}
    .source-list {{ margin-top: 12px; display: grid; gap: 12px; }}
    .source-pill {{ display: flex; justify-content: space-between; gap: 14px; padding: 11px 12px; border: 1px solid rgba(122,184,255,.2); background: rgba(122,184,255,.07); color: #d9ecff; font-size: 17px; font-weight: 800; }}
    .source-pill span:last-child {{ color: var(--muted); font-size: 15px; }}
    .footer {{ display: grid; grid-template-columns: 1fr auto; gap: 22px; align-items: end; border-top: 1px solid rgba(138,182,255,.18); padding-top: 14px; }}
    .closing {{ color: #d7ebe7; font-size: 18px; line-height: 1.32; font-weight: 720; }}
    .footer-brand {{ color: var(--cyan); font-size: 22px; font-weight: 900; letter-spacing: 3px; white-space: nowrap; }}
  </style>
</head>
<body>
  <main class="canvas">
    <div class="content">
      <header class="topbar"><section><div class="brand-row"><div class="logo-mark">{esc(c["brand"][0].upper())}</div><div><div class="brand-name">{esc(c["brand"])}</div><div class="brand-sub">AI DAILY INTELLIGENCE</div></div></div><div class="date-chip">{date_display(c["date"])} · {esc(c["confidence"])}</div><h1 class="headline">{h}</h1><div class="dek">{esc(c["dek"])}</div></section><aside class="qr-card"><div class="qr-title">{esc(c["qr_label"])}</div><div class="qr-box">{esc(c["qr_placeholder"])}</div></aside></header>
      <section class="status-row"><article class="panel editor-note"><div class="panel-label">主编总结</div><p>{esc(c["editorial"])}</p></article><aside class="panel signal-card"><div><div class="signal-title">今日主线</div><div class="signal-value">{esc(c["theme"])}</div></div><div class="metric-grid"><div class="metric"><div class="metric-head"><span>AI 可用线索</span><span>{len(c["items"])}</span></div><div class="bar"><span style="width: 68%"></span></div></div><div class="metric"><div class="metric-head"><span>工程化信号</span><span>强</span></div><div class="bar"><span style="width: 72%"></span></div></div><div class="metric"><div class="metric-head"><span>日报置信度</span><span>{esc(c["confidence"].replace("简报", ""))}</span></div><div class="bar"><span style="width: 38%; background: linear-gradient(90deg, var(--amber), var(--red))"></span></div></div></div></aside></section>
      <section class="main-grid"><article class="panel story-list"><div class="section-title"><h2>AI 最值得关注的 {len(c["items"])} 条</h2><span>来源集中于 {esc(c["source_label"])}</span></div>{stories_html}</article><aside class="side-stack"><section class="panel keyword-card"><div class="panel-label">今日关键词</div><div class="keyword-list">{keyword_html}</div></section><section class="panel insight-card"><div class="panel-label">今日判断</div><div class="insight-title">Agent 正在进入可部署阶段</div><p class="small-copy">今天没有强热点爆发，但开发者讨论继续指向同一件事：Agent 落地需要工作流、权限、安全、评测和可观测性。</p></section><section class="panel source-card"><div class="panel-label">信息状态</div><div class="source-list"><div class="source-pill"><span>可用 AI 线索</span><span>{len(c["items"])} 条</span></div><div class="source-pill"><span>主要来源</span><span>{esc(c["source_label"])}</span></div><div class="source-pill"><span>日报置信度</span><span>{esc(c["confidence"].replace("简报", ""))}</span></div></div></section></aside></section>
      <footer class="footer"><div class="closing">主编一句话：{esc(c["judgement"])}</div><div class="footer-brand">{esc(c["brand"].upper())} DAILY</div></footer>
    </div>
  </main>
</body>
</html>
"""


def render_html(report: dict, style: str, palette: str) -> str:
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
    parser.add_argument("--style", choices=["research", "dark"], default=DEFAULT_STYLE)
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
        for style in ["research", "dark"]:
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
