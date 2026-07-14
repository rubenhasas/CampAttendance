#!/usr/bin/env python3
"""
QR Name Tag Generator for Camp Attendance.

Generates a printable A4 PDF of blank name tags with QR codes.
Tags are designed to be laminated blank, with names written on with marker.

Usage:
    pip install qrcode[pil] reportlab
    python generate_tags.py --start 1000 --count 80
    python generate_tags.py --start 1000 --count 80 --csv  # also generates kids.csv
"""

import argparse
import csv
import io
from pathlib import Path

import qrcode
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader


# Page layout constants
PAGE_W, PAGE_H = A4  # 210mm x 297mm
COLS = 2
ROWS = 4
TAGS_PER_PAGE = COLS * ROWS

# Tag dimensions
TAG_W = 90 * mm
TAG_H = 60 * mm

# Margins to center the grid on the page
MARGIN_X = (PAGE_W - COLS * TAG_W) / 2
MARGIN_Y = (PAGE_H - ROWS * TAG_H) / 2

# QR code settings
QR_SIZE = 22 * mm
QR_MARGIN_RIGHT = 5 * mm
QR_MARGIN_BOTTOM = 5 * mm

# ID label settings
ID_FONT_SIZE = 14


def generate_qr_image(data: str) -> ImageReader:
    """Generate a QR code image for the given data string."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=2,
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return ImageReader(buf)


def draw_tag(c: canvas.Canvas, x: float, y: float, tag_id: int):
    """Draw a single name tag at position (x, y) being the bottom-left corner."""
    # Tag border (dashed cut line)
    c.setStrokeColorRGB(0.7, 0.7, 0.7)
    c.setDash(3, 3)
    c.setLineWidth(0.5)
    c.rect(x, y, TAG_W, TAG_H)
    c.setDash()  # reset dash

    # QR code in bottom-right corner
    qr_x = x + TAG_W - QR_SIZE - QR_MARGIN_RIGHT
    qr_y = y + QR_MARGIN_BOTTOM
    qr_img = generate_qr_image(str(tag_id))
    c.drawImage(qr_img, qr_x, qr_y, QR_SIZE, QR_SIZE)

    # Thin quiet zone border around QR
    c.setStrokeColorRGB(0.85, 0.85, 0.85)
    c.setLineWidth(0.3)
    padding = 2 * mm
    c.rect(qr_x - padding, qr_y - padding,
           QR_SIZE + 2 * padding, QR_SIZE + 2 * padding)

    # ID number below the QR code area (or beside it)
    c.setFont("Helvetica-Bold", ID_FONT_SIZE)
    c.setFillColorRGB(0, 0, 0)
    id_text = str(tag_id)
    text_w = c.stringWidth(id_text, "Helvetica-Bold", ID_FONT_SIZE)
    id_x = qr_x + (QR_SIZE - text_w) / 2
    id_y = qr_y - ID_FONT_SIZE - 2
    c.drawString(id_x, id_y, id_text)

    # Reset fill
    c.setFillColorRGB(0, 0, 0)


def generate_pdf(start_id: int, count: int, output: str):
    """Generate the name tag PDF."""
    c = canvas.Canvas(output, pagesize=A4)
    c.setTitle("Ecusoane Tabara")

    for i in range(count):
        tag_id = start_id + i
        page_index = i % TAGS_PER_PAGE
        col = page_index % COLS
        row = ROWS - 1 - (page_index // COLS)  # top-to-bottom

        x = MARGIN_X + col * TAG_W
        y = MARGIN_Y + row * TAG_H

        draw_tag(c, x, y, tag_id)

        # New page after filling current one (but not after the last tag)
        if page_index == TAGS_PER_PAGE - 1 and i < count - 1:
            c.showPage()

    c.save()
    print(f"Generated {output} with {count} tags (IDs {start_id}-{start_id + count - 1})")


def generate_csv(start_id: int, count: int, output: str):
    """Generate a skeleton CSV file with IDs and empty names."""
    with open(output, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["ID", "Nume"])
        for i in range(count):
            writer.writerow([start_id + i, ""])
    print(f"Generated {output} with {count} rows")


def main():
    parser = argparse.ArgumentParser(
        description="Generate QR name tags for camp attendance"
    )
    parser.add_argument("--start", type=int, default=1000,
                        help="Starting ID number (default: 1000)")
    parser.add_argument("--count", type=int, default=80,
                        help="Number of tags to generate (default: 80)")
    parser.add_argument("--output", type=str, default="nametags.pdf",
                        help="Output PDF filename (default: nametags.pdf)")
    parser.add_argument("--csv", action="store_true",
                        help="Also generate a kids.csv skeleton file")
    args = parser.parse_args()

    generate_pdf(args.start, args.count, args.output)

    if args.csv:
        csv_name = Path(args.output).stem + ".csv"
        generate_csv(args.start, args.count, "kids.csv")


if __name__ == "__main__":
    main()
