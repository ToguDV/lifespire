#!/usr/bin/env python3
"""Generate the LifeSpire PWA icons from the original favicon spire.

The favicon marks the same tower in a 24×24 viewBox. This script recreates
those strokes with Pillow so the PNG set stays original and reproducible.

Usage: python3 scripts/generate-pwa-icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "icons"

BACKGROUND = "#131511"
STROKE = "#9dbba8"
SUPERSAMPLE = 4

# The favicon's 24×24 geometry: trunk, base, roof and two windows.
SEGMENTS = [
    ((12.0, 20.0), (12.0, 9.0)),
    ((8.5, 20.0), (15.5, 20.0)),
    ((8.5, 9.0), (12.0, 3.0)),
    ((12.0, 3.0), (15.5, 9.0)),
    ((9.5, 13.0), (14.5, 13.0)),
    ((9.5, 17.0), (14.5, 17.0)),
]


def rounded_line(draw: ImageDraw.ImageDraw, start, end, width: float, fill: str) -> None:
    """Draw a line with round caps, matching the favicon's stroke style."""
    draw.line([start, end], fill=fill, width=round(width))
    radius = width / 2
    for x, y in (start, end):
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=fill)


def draw_spire(draw: ImageDraw.ImageDraw, size: int, scale: float, color: str) -> None:
    unit = size * scale / 24
    offset_x = (size - 24 * unit) / 2
    offset_y = (size - 24 * unit) / 2
    stroke = 1.5 * unit

    def point(x: float, y: float) -> tuple[float, float]:
        return (offset_x + x * unit, offset_y + y * unit)

    for start, end in SEGMENTS:
        rounded_line(draw, point(*start), point(*end), stroke, color)


def icon(size: int, scale: float, rounded: bool) -> Image.Image:
    canvas = size * SUPERSAMPLE
    image = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    if rounded:
        radius = round(canvas * 0.18)
        draw.rounded_rectangle((0, 0, canvas - 1, canvas - 1), radius=radius, fill=BACKGROUND)
    else:
        draw.rectangle((0, 0, canvas - 1, canvas - 1), fill=BACKGROUND)

    draw_spire(draw, canvas, scale, STROKE)
    return image.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    icon(192, 0.88, rounded=True).save(OUT / "icon-192.png", optimize=True)
    icon(512, 0.88, rounded=True).save(OUT / "icon-512.png", optimize=True)

    # Maskable icons keep the tower inside the central safe zone and bleed the
    # background to every edge so launchers can crop any shape.
    icon(192, 0.70, rounded=False).save(OUT / "icon-192-maskable.png", optimize=True)
    icon(512, 0.70, rounded=False).save(OUT / "icon-512-maskable.png", optimize=True)

    # iOS applies its own mask, so no transparency is needed here.
    icon(180, 0.82, rounded=False).save(OUT / "apple-touch-icon.png", optimize=True)

    print(f"Wrote PWA icons to {OUT}")


if __name__ == "__main__":
    main()
