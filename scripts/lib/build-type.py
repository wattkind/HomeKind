#!/usr/bin/env python3
"""Build the HomeKind wordmark and tagline as outlined SVG.

The logo type is committed as vector outlines rather than live text so the brand files
render identically wherever they are opened, with no font to install. Run this only when
the wordmark or tagline changes:

    pip install fonttools uharfbuzz
    python3 scripts/lib/build-type.py

Colour split follows the WattKind family rule: the product half of the name is Ink and
the "Kind" half carries the primary warm gradient.
"""

import json
import subprocess
import sys
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parents[2]
FONTS = ROOT / "public/assets/fonts"
OUT = ROOT / "public/assets/brand/logos"

INK = "#111827"
SLATE = "#374151"
CORAL_TEXT = "#B9383E"
STONE = "#6B7280"
CORAL = "#FF6B6B"
TANGERINE = "#FF8C3A"


def shape(font_path: Path, text: str, wght: float, split_index: int) -> dict:
    out = subprocess.run(
        [sys.executable, str(Path(__file__).parent / "wordmark-outline.py"),
         str(font_path), text, str(wght), str(split_index)],
        capture_output=True, text=True, check=True,
    )
    return json.loads(out.stdout)


def ink_bounds(font_path: Path, wght: float, shaped: dict) -> tuple:
    tt = instancer.instantiateVariableFont(TTFont(font_path), {"wght": wght})
    glyph_set = tt.getGlyphSet()
    order = tt.getGlyphOrder()
    # Re-derive per-glyph bounds by replaying the same shaping offsets.
    import uharfbuzz as hb  # noqa: PLC0415 - only needed here

    box = [None, None, None, None]
    blob = hb.Blob.from_file_path(str(font_path))
    face = hb.Face(blob)
    hb_font = hb.Font(face)
    hb_font.scale = (face.upem, face.upem)
    hb_font.set_variations({"wght": wght})
    buf = hb.Buffer()
    buf.add_str(shaped["text"])
    buf.guess_segment_properties()
    hb.shape(hb_font, buf)

    x = 0.0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        pen = BoundsPen(glyph_set)
        glyph_set[order[info.codepoint]].draw(
            TransformPen(pen, (1, 0, 0, 1, x + pos.x_offset, pos.y_offset))
        )
        if pen.bounds:
            x0, y0, x1, y1 = pen.bounds
            box = [
                x0 if box[0] is None else min(box[0], x0),
                y0 if box[1] is None else min(box[1], y0),
                x1 if box[2] is None else max(box[2], x1),
                y1 if box[3] is None else max(box[3], y1),
            ]
        x += pos.x_advance
    return tuple(box)


def build(name: str, font: str, text: str, wght: float, split_index: int,
          head_fill: str, tail_gradient: bool, tail_fill: str, label: str) -> None:
    font_path = FONTS / font
    shaped = shape(font_path, text, wght, split_index)
    shaped["text"] = text
    x0, y0, x1, y1 = ink_bounds(font_path, wght, shaped)

    pad = 12  # font units of breathing room inside the viewBox
    w, h = (x1 - x0) + pad * 2, (y1 - y0) + pad * 2

    head = [p for p in shaped["paths"] if not p["split"]]
    tail = [p for p in shaped["paths"] if p["split"]]

    def group(paths, fill):
        body = "".join(
            f'<path transform="translate({p["x"] - x0 + pad:.1f} {p["y"]:.1f})" d="{p["d"]}"/>'
            for p in paths
        )
        return f'<g fill="{fill}">{body}</g>'

    # The gradient runs across the "Kind" half only, matching the supplied family logos.
    tail_x0 = min((p["x"] for p in tail), default=0) - x0 + pad
    defs = ""
    tail_paint = tail_fill
    if tail_gradient:
        defs = (
            f'<defs><linearGradient id="{name}-g" x1="{tail_x0:.0f}" y1="{y1:.0f}" '
            f'x2="{w:.0f}" y2="{y0:.0f}" gradientUnits="userSpaceOnUse">'
            f'<stop stop-color="{CORAL}"/><stop offset="1" stop-color="{TANGERINE}"/>'
            f"</linearGradient></defs>"
        )
        tail_paint = f"url(#{name}-g)"

    # Intrinsic size at a 100px em, so rasterisers get a sensible default.
    px = 0.1
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" '
        f'width="{w * px:.0f}" height="{h * px:.0f}" '
        f'role="img" aria-label="{label}">{defs}'
        f'<g transform="translate(0 {y1 + pad:.1f}) scale(1 -1)">'
        f"{group(head, head_fill)}{group(tail, tail_paint)}"
        f"</g></svg>\n"
    )
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{name}.svg").write_text(svg)
    print(f"wrote {name}.svg  ({w:.0f}x{h:.0f} units)")


if __name__ == "__main__":
    build(
        "homekind-wordmark", "Nunito-Variable.ttf", "HomeKind", 850, 4,
        head_fill=INK, tail_gradient=True, tail_fill=CORAL, label="HomeKind",
    )
    build(
        "homekind-tagline", "Inter-Variable.ttf",
        "Home support that remembers for you. ♥", 500, 18,
        head_fill=SLATE, tail_gradient=False, tail_fill=CORAL_TEXT,
        label="Home support that remembers for you.",
    )
    # Byline for footers and the social card: no colour split, so the whole string is "tail".
    build(
        "homekind-byline", "Inter-Variable.ttf", "A WattKind AI product", 500, 0,
        head_fill=STONE, tail_gradient=False, tail_fill=STONE,
        label="A WattKind AI product",
    )
