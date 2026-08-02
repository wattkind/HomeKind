#!/usr/bin/env python3
"""Convert a string into SVG outline paths using a variable font at a fixed weight.

Used to build the HomeKind wordmark as vector paths, so the committed logo files do
not depend on a font being installed wherever they are opened.

Usage:
    python3 wordmark-outline.py <font.ttf> <text> <wght> [split_index]

Prints JSON: {upem, advance, paths: [{d, x}], split: {head_advance}} where `split_index`
is the character offset at which the wordmark changes colour (e.g. 4 for "Home|Kind").
"""

import json
import sys

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer


def main() -> None:
    font_path, text, wght = sys.argv[1], sys.argv[2], float(sys.argv[3])
    split_index = int(sys.argv[4]) if len(sys.argv) > 4 else None

    # Shape with HarfBuzz so kerning and spacing match what a real text engine would do.
    blob = hb.Blob.from_file_path(font_path)
    face = hb.Face(blob)
    hb_font = hb.Font(face)
    upem = face.upem
    hb_font.scale = (upem, upem)
    hb_font.set_variations({"wght": wght})

    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(hb_font, buf)

    # Pin the variable font to the same weight so the outlines match the shaping.
    tt = instancer.instantiateVariableFont(TTFont(font_path), {"wght": wght})
    glyph_set = tt.getGlyphSet()
    glyph_order = tt.getGlyphOrder()

    paths = []
    x = 0.0
    head_advance = None
    for i, (info, pos) in enumerate(zip(buf.glyph_infos, buf.glyph_positions)):
        if split_index is not None and info.cluster >= split_index and head_advance is None:
            head_advance = x
        name = glyph_order[info.codepoint]
        pen = SVGPathPen(glyph_set)
        glyph_set[name].draw(pen)
        d = pen.getCommands()
        if d:
            paths.append({"d": d, "x": x + pos.x_offset, "y": pos.y_offset, "split": head_advance is not None})
        x += pos.x_advance

    json.dump(
        {"upem": upem, "advance": x, "headAdvance": head_advance, "paths": paths},
        sys.stdout,
    )


if __name__ == "__main__":
    main()
