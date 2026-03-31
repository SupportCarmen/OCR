"""
Image pre-processing utilities.
Enhance receipt images before sending to OCR for better accuracy.
"""

from PIL import Image, ImageFilter, ImageEnhance
import io
import os
from typing import Optional


def preprocess_image(
    image_bytes: bytes,
    *,
    grayscale: bool = True,
    contrast_factor: float = 1.5,
    sharpness_factor: float = 2.0,
    denoise: bool = True,
    max_dimension: int = 4096,
) -> bytes:
    """
    Pre-process an image to improve OCR accuracy on receipts/invoices.

    Steps:
    1. Resize if too large (prevent OOM)
    2. Convert to grayscale (reduces noise for text detection)
    3. Enhance contrast (bank receipts are often faded)
    4. Sharpen (makes text edges crisper)
    5. Light denoise
    """
    img = Image.open(io.BytesIO(image_bytes))

    # ── 1. Resize if too large ──
    if max(img.size) > max_dimension:
        ratio = max_dimension / max(img.size)
        new_size = (int(img.width * ratio), int(img.height * ratio))
        img = img.resize(new_size, Image.LANCZOS)

    # ── 2. Convert to grayscale ──
    if grayscale and img.mode != "L":
        img = img.convert("L")

    # ── 3. Enhance contrast ──
    if contrast_factor != 1.0:
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(contrast_factor)

    # ── 4. Sharpen ──
    if sharpness_factor != 1.0:
        enhancer = ImageEnhance.Sharpness(img)
        img = enhancer.enhance(sharpness_factor)

    # ── 5. Denoise ──
    if denoise:
        img = img.filter(ImageFilter.MedianFilter(size=3))

    # Convert back to bytes
    output = io.BytesIO()
    img.save(output, format="PNG", optimize=True)
    return output.getvalue()


def get_image_info(image_bytes: bytes) -> dict:
    """Return basic info about an uploaded image."""
    img = Image.open(io.BytesIO(image_bytes))
    return {
        "width": img.width,
        "height": img.height,
        "format": img.format,
        "mode": img.mode,
        "size_kb": len(image_bytes) / 1024,
    }


def is_valid_image(filename: str) -> bool:
    """Check if the filename has a supported image extension."""
    valid_extensions = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".webp", ".pdf"}
    ext = os.path.splitext(filename)[1].lower()
    return ext in valid_extensions
