#!/usr/bin/env python3
"""把一个系列的卡片批量导出为成品图。

正式产线导出：playwright(headless chromium) 逐张加载卡片 HTML，2x 超采样截 .card，
再用 Pillow LANCZOS 降回 1080×1440，存无损 WebP。封装了画质规范，任何替代实现都必须等价满足：
  - 视口 1080×1440 + device_scale_factor=2（2x 超采样）
  - 只截 .card 元素，等 document.fonts.ready 再截
  - LANCZOS 降采样到真实成品尺寸 1080×1440（1:1）
  - WebP 无损（lossless），按 pages.json 顺序命名 01.webp…NN.webp

用法：
  python3 scripts/export.py dist/<series>
  python3 scripts/export.py dist/<series> --out dist/<series>/snapshot

依赖：pip install playwright pillow && playwright install chromium
"""

import argparse
import json
import sys
from pathlib import Path

CARD_W, CARD_H = 1080, 1440          # 小红书成品真实尺寸（不可改）
SCALE = 2                            # 2x 超采样


def load_pages(series_dir: Path):
    cfg_path = series_dir / "pages.json"
    if not cfg_path.exists():
        sys.exit(f"找不到 {cfg_path}，请确认这是一个系列目录")
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    pages = cfg.get("pages")
    if not isinstance(pages, list) or not pages:
        sys.exit("pages.json 需要非空的 pages 数组")
    srcs = []
    for i, page in enumerate(pages):
        src = (page or {}).get("src", "").strip()
        if not src:
            sys.exit(f"pages.json 第 {i + 1} 项缺少 src")
        srcs.append(src)
    return srcs


def export(series_dir: Path, out_dir: Path):
    try:
        from playwright.sync_api import sync_playwright
        from PIL import Image
    except ImportError:
        sys.exit("缺少依赖：pip install playwright pillow && playwright install chromium")

    srcs = load_pages(series_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(
            viewport={"width": CARD_W, "height": CARD_H},
            device_scale_factor=SCALE,
        )
        for i, src in enumerate(srcs):
            card_html = (series_dir / src).resolve()
            if not card_html.exists():
                sys.exit(f"找不到卡片：{card_html}")
            page.goto(card_html.as_uri())
            page.wait_for_function("document.fonts ? document.fonts.ready.then(() => true) : true")
            page.wait_for_timeout(120)  # 给字体/布局一点缓冲，避免掉字

            card = page.query_selector(".card")
            if card is None:
                sys.exit(f"{src} 里没有 .card 元素")

            name = f"{i + 1:02d}.webp"
            raw_png = out_dir / f".{name}.2x.png"
            card.screenshot(path=str(raw_png))  # 2160×2880 原图

            img = Image.open(raw_png).convert("RGB")
            img = img.resize((CARD_W, CARD_H), Image.LANCZOS)  # 降回 1:1
            img.save(out_dir / name, "WEBP", lossless=True)
            raw_png.unlink(missing_ok=True)

            w, h = Image.open(out_dir / name).size
            ok = "OK" if (w, h) == (CARD_W, CARD_H) else "尺寸异常!"
            print(f"  {name}  {w}x{h}  {ok}")

        browser.close()

    print(f"已导出 {len(srcs)} 张到 {out_dir}")


def main():
    ap = argparse.ArgumentParser(description="把一个系列的卡片导出为 1080×1440 无损 WebP")
    ap.add_argument("series_dir", help="系列目录，如 dist/claude-code-quick-reference")
    ap.add_argument("--out", help="输出目录，默认 <series_dir>/snapshot")
    args = ap.parse_args()

    series_dir = Path(args.series_dir).resolve()
    if not series_dir.is_dir():
        sys.exit(f"系列目录不存在：{series_dir}")
    out_dir = Path(args.out).resolve() if args.out else series_dir / "snapshot"
    export(series_dir, out_dir)


if __name__ == "__main__":
    main()
