"""Render the dsh-cuawright icon to a square PNG for the marketplace tile.

Mirrors icon.svg (window frame, title divider, prompt chevron, underscore) but
draws at 4x and downsamples so the strokes stay smooth at tile size.
"""

from pathlib import Path

from PIL import Image, ImageDraw

SCALE = 8
SIZE = 180
CANVAS = SIZE * SCALE
STROKE = int(2 * SCALE * SIZE / 36)  # icon.svg is a 36-unit grid
COLOR = (63, 111, 216, 255)  # #3f6fd8


def unit(value: float) -> int:
    return int(round(value * CANVAS / 36))


def main() -> None:
    image = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    half = STROKE // 2

    # Window frame with a title divider.
    draw.rounded_rectangle(
        [unit(5.5) + half, unit(7.5) + half, unit(30.5) - half, unit(28.5) - half],
        radius=unit(3.5),
        outline=COLOR,
        width=STROKE,
    )
    draw.line([unit(5.5), unit(13.5), unit(30.5), unit(13.5)], fill=COLOR, width=STROKE)

    # Prompt chevron.
    draw.line(
        [unit(10.5), unit(18.5), unit(14), unit(21.5), unit(10.5), unit(24.5)],
        fill=COLOR,
        width=STROKE,
        joint="curve",
    )

    # Underscore.
    draw.line([unit(17), unit(24.5), unit(21.5), unit(24.5)], fill=COLOR, width=STROKE)

    icon = image.resize((SIZE, SIZE), Image.LANCZOS)
    target = Path(__file__).parent / "icon-180.png"
    icon.save(target, "PNG", optimize=True)
    print(f"wrote {target} ({target.stat().st_size} bytes, {SIZE}x{SIZE})")


if __name__ == "__main__":
    main()
