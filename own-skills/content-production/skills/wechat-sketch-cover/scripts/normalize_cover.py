#!/usr/bin/env python3
"""Center-crop and resize one static raster cover to 1923 x 818 PNG."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError


WIDTH = 1923
HEIGHT = 818
TARGET_RATIO = WIDTH / HEIGHT


def normalize(input_path: Path, output_path: Path) -> dict[str, object]:
    if not input_path.is_file():
        raise ValueError(f"input is not a readable file: {input_path}")
    if output_path.suffix.lower() != ".png":
        raise ValueError("output path must end in .png")
    if output_path.exists():
        raise FileExistsError(f"refusing to overwrite existing output: {output_path}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = output_path.with_name(f".{output_path.name}.tmp-{os.getpid()}")

    try:
        with Image.open(input_path) as source:
            if getattr(source, "is_animated", False):
                raise ValueError("animated images are not supported")

            source = ImageOps.exif_transpose(source).convert("RGB")
            original_width, original_height = source.size
            if original_width < 1 or original_height < 1:
                raise ValueError("input image has invalid dimensions")

            source_ratio = original_width / original_height
            if source_ratio > TARGET_RATIO:
                crop_width = round(original_height * TARGET_RATIO)
                left = (original_width - crop_width) // 2
                box = (left, 0, left + crop_width, original_height)
            else:
                crop_height = round(original_width / TARGET_RATIO)
                top = (original_height - crop_height) // 2
                box = (0, top, original_width, top + crop_height)

            cropped = source.crop(box)
            normalized = cropped.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
            normalized.save(temp_path, format="PNG", optimize=True)

        os.replace(temp_path, output_path)
    except Exception:
        temp_path.unlink(missing_ok=True)
        raise

    return {
        "input": str(input_path.resolve()),
        "output": str(output_path.resolve()),
        "originalWidth": original_width,
        "originalHeight": original_height,
        "cropBox": list(box),
        "width": WIDTH,
        "height": HEIGHT,
        "format": "PNG",
    }


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(
            "Usage: normalize_cover.py <input-image> <output.png>",
            file=sys.stderr,
        )
        return 2

    try:
        result = normalize(Path(argv[1]).expanduser(), Path(argv[2]).expanduser())
    except (FileExistsError, OSError, UnidentifiedImageError, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        return 1

    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
