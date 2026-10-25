"""Generate mesh-like SVG gradients from bookmark colors."""

from __future__ import annotations

import random
import re
from collections.abc import Sequence

DEFAULT_BOOKMARK_COLOR = "#8C8C8C"
_HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")


def build_bookmark_gradient_svg(
    colors: Sequence[str],
    *,
    seed: int | None = None,
    gradient_id: str = "bookmark-gradient",
) -> str:
    """Build a mesh-like SVG background using every valid bookmark color.

    Each color becomes a softly fading radial blob at a random position. This
    keeps repeated colors weighted while producing the overlapping, blurred
    appearance of a mesh gradient. ``seed`` makes the result deterministic for
    tests and previews.
    """
    valid_colors = [color.upper() for color in colors if _HEX_COLOR.fullmatch(color)]
    if not valid_colors:
        valid_colors = [DEFAULT_BOOKMARK_COLOR]

    generator = random.Random(seed)
    generator.shuffle(valid_colors)
    gradients: list[str] = []
    blobs: list[str] = []
    for index, color in enumerate(valid_colors):
        center_x = generator.uniform(-0.15, 1.15) * 320
        center_y = generator.uniform(-0.25, 1.25) * 80
        radius = generator.uniform(95.0, 220.0)
        gradient_name = f"{gradient_id}-blob-{index}"
        gradients.append(
            f'<radialGradient id="{gradient_name}" gradientUnits="userSpaceOnUse" '
            f'cx="{center_x:.2f}" cy="{center_y:.2f}" r="{radius:.2f}">'
            f'<stop offset="0%" stop-color="{color}" stop-opacity="0.92" />'
            f'<stop offset="48%" stop-color="{color}" stop-opacity="0.54" />'
            f'<stop offset="100%" stop-color="{color}" stop-opacity="0" />'
            "</radialGradient>"
        )
        blobs.append(f'<rect width="320" height="80" fill="url(#{gradient_name})" />')

    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 80" '
        'preserveAspectRatio="none">'
        f'<defs>{"".join(gradients)}</defs>'
        '<rect width="320" height="80" fill="#F6F3FF" />'
        f'{"".join(blobs)}'
        "</svg>"
    )
