#!/usr/bin/env python3
"""
SemKit PDF Worker (PyMuPDF + Pillow)
- Converts images (.jpg/.png) to upright, optimized %PDF-
- Compresses any PDF strictly under max_mb (default 9.5 MB < 10 MB limit)
- Bypasses Google Drive >100 MB virus scan confirmation pages via cookie jar
- Extracts first N pages' text for smart Unit / Exam classification
Supports persistent --server JSONL mode over stdin/stdout (zero startup overhead)
and single-shot CLI mode for standalone testing.
"""

import argparse
import http.cookiejar
import io
import json
import os
import re
import shutil
import sys
import urllib.request
from PIL import Image, ImageEnhance, ImageOps
import pymupdf

pymupdf.TOOLS.mupdf_display_errors(False)
pymupdf.TOOLS.mupdf_display_warnings(False)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


def download_gdrive_to_file(file_id: str, out_path: str, timeout: int = 180) -> dict:
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    opener.addheaders = [("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")]
    url = f"https://drive.google.com/uc?export=download&id={file_id}"
    resp = opener.open(url, timeout=60)
    first_chunk = resp.read(65536)

    def _stream_rest(r, initial: bytes, target_path: str) -> int:
        os.makedirs(os.path.dirname(os.path.abspath(target_path)), exist_ok=True)
        total = 0
        with open(target_path, "wb") as f:
            if initial:
                f.write(initial)
                total += len(initial)
            while True:
                buf = r.read(1048576)
                if not buf:
                    break
                f.write(buf)
                total += len(buf)
        return total

    head_l = first_chunk.lstrip()[:15].lower()
    if head_l.startswith(b"<!doctype html") or head_l.startswith(b"<html"):
        html_bytes = first_chunk + resp.read(2097152)
        html = html_bytes.decode("utf-8", errors="ignore")
        m_action = re.search(r'action="([^"]+)"', html)
        m_uuid = re.search(r'name="uuid"\s+value="([^"]+)"', html)
        if m_action and m_uuid:
            dl_url = f"{m_action.group(1)}?id={file_id}&export=download&confirm=t&uuid={m_uuid.group(1)}"
        else:
            dl_url = f"https://drive.usercontent.google.com/download?id={file_id}&export=download&confirm=t"
        resp2 = opener.open(dl_url, timeout=timeout)
        first2 = resp2.read(65536)
        size = _stream_rest(resp2, first2, out_path)
    else:
        size = _stream_rest(resp, first_chunk, out_path)

    return {"ok": True, "bytes": size}


def image_to_pdf(in_path: str, out_path: str, max_mb: float = 9.5) -> dict:
    with Image.open(in_path) as im:
        im = ImageOps.exif_transpose(im)
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        elif im.mode == "L":
            im = im.convert("RGB")

        max_dim = 1600
        if im.width > max_dim or im.height > max_dim:
            im.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

        quality = 84
        max_bytes = int(max_mb * 1048576)
        while quality >= 40:
            buf = io.BytesIO()
            im.save(buf, format="JPEG", quality=quality, optimize=True)
            jpg_bytes = buf.getvalue()
            doc = pymupdf.open()
            page = doc.new_page(width=im.width, height=im.height)
            page.insert_image(page.rect, stream=jpg_bytes)
            pdf_bytes = doc.tobytes(garbage=4, deflate=True)
            doc.close()
            if len(pdf_bytes) <= max_bytes or quality <= 45:
                os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
                with open(out_path, "wb") as f:
                    f.write(pdf_bytes)
                return {
                    "ok": True,
                    "bytes": len(pdf_bytes),
                    "pages": 1,
                    "method": "image_to_pdf",
                    "text": "",
                }
            quality -= 12

    return {"ok": False, "error": "Failed to convert image under target size"}


def extract_preview_text(doc: pymupdf.Document, max_pages: int = 3) -> str:
    parts = []
    limit = min(len(doc), max_pages)
    for i in range(limit):
        try:
            t = doc[i].get_text().strip()
            if t:
                parts.append(t)
        except Exception:
            pass
    return "\n".join(parts)[:3000]


def _render_raster_pdf(doc: pymupdf.Document, width_px: int, quality: int, boost_contrast: bool) -> bytes:
    out_doc = pymupdf.open()
    for i in range(len(doc)):
        page = doc[i]
        scale = min(2.0, width_px / max(1.0, page.rect.width))
        pix = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False)
        pil_img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        if boost_contrast:
            pil_img = ImageEnhance.Contrast(pil_img).enhance(1.12)
        buf = io.BytesIO()
        pil_img.save(buf, format="JPEG", quality=quality, optimize=True)
        new_page = out_doc.new_page(width=page.rect.width, height=page.rect.height)
        new_page.insert_image(new_page.rect, stream=buf.getvalue())
    out_bytes = out_doc.tobytes(garbage=4, deflate=True)
    out_doc.close()
    return out_bytes


def _estimate_raster_size(doc: pymupdf.Document, width_px: int, quality: int, boost_contrast: bool) -> int:
    n = len(doc)
    if n == 0:
        return 0
    sample_indices = sorted(set([0, max(0, n // 3), max(0, (2 * n) // 3), n - 1]))
    total_sample = 0
    for idx in sample_indices:
        page = doc[idx]
        scale = min(2.0, width_px / max(1.0, page.rect.width))
        pix = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False)
        pil_img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        if boost_contrast:
            pil_img = ImageEnhance.Contrast(pil_img).enhance(1.12)
        buf = io.BytesIO()
        pil_img.save(buf, format="JPEG", quality=quality, optimize=True)
        total_sample += buf.tell()
    avg_page_img = total_sample / len(sample_indices)
    # Add ~700 bytes per page for PDF object overhead
    return int((avg_page_img + 700) * n)


def compress_and_inspect_pdf(in_path: str, out_path: str, max_mb: float = 9.5) -> dict:
    in_size = os.path.getsize(in_path)
    if in_size == 0:
        return {"ok": False, "error": "empty_file"}

    with open(in_path, "rb") as f:
        hdr = f.read(16)
    if b"%PDF-" not in hdr:
        return {"ok": False, "error": f"not_a_pdf:{hdr[:12]!r}"}

    doc = pymupdf.open(in_path)
    if doc.needs_pass:
        doc.authenticate("")
    n_pages = len(doc)
    if n_pages == 0:
        doc.close()
        return {"ok": False, "error": "zero_pages"}

    preview_text = extract_preview_text(doc, 3)
    max_bytes = int(max_mb * 1048576)

    # Already strictly under target size -> just copy cleanly without touching quality
    if in_size <= max_bytes:
        doc.close()
        os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
        if os.path.abspath(in_path) != os.path.abspath(out_path):
            shutil.copy2(in_path, out_path)
        return {
            "ok": True,
            "bytes": in_size,
            "in_bytes": in_size,
            "pages": n_pages,
            "method": "passthrough",
            "text": preview_text,
        }

    # Check whether document is true vector text (e.g. slides/Word/LaTeX with high-res PNGs)
    sample_indices = sorted(set([0, n_pages // 2, n_pages - 1]))
    text_chars = sum(len(doc[i].get_text().strip()) for i in sample_indices)
    is_mostly_fullpage_scan = True
    for i in sample_indices:
        imgs = doc[i].get_images(full=True)
        if not imgs or len(doc[i].get_text().strip()) > 350:
            # Has substantial selectable text; check if vector works quickly
            is_mostly_fullpage_scan = False
            break

    # Skip slow multi-pass rewrite_images on gigantic scanned books (>35MB & >150 pages)
    try_vector = (text_chars >= 100) and not (in_size > 35 * 1048576 and n_pages > 150)

    if try_vector:
        doc.close()
        configs = [(130, 96, 58), (96, 72, 42)]
        for dpi_t, dpi_g, qual in configs:
            dtry = pymupdf.open(in_path)
            if dtry.needs_pass:
                dtry.authenticate("")
            try:
                dtry.rewrite_images(
                    dpi_threshold=dpi_t,
                    dpi_target=dpi_g,
                    quality=qual,
                    lossy=True,
                    lossless=True,
                )
            except Exception:
                pass
            cand = dtry.tobytes(garbage=4, deflate=True, clean=True)
            dtry.close()
            if len(cand) <= max_bytes:
                os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
                with open(out_path, "wb") as f:
                    f.write(cand)
                return {
                    "ok": True,
                    "bytes": len(cand),
                    "in_bytes": in_size,
                    "pages": n_pages,
                    "method": f"vector_{dpi_g}_q{qual}",
                    "text": preview_text,
                }
            # If first vector try stayed huge (>2.4x target), go straight to calibrated rasterizer
            if len(cand) > max_bytes * 2.4:
                break
        doc = pymupdf.open(in_path)
        if doc.needs_pass:
            doc.authenticate("")

    # Fast sample-calibrated rasterizer: guarantees < max_mb in typically 1 full pass
    boost = text_chars < 150 or is_mostly_fullpage_scan
    budget_per_page = (max_bytes * 0.89) / max(1, n_pages)
    if budget_per_page >= 110_000:
        w, q = 1220, 74
    elif budget_per_page >= 65_000:
        w, q = 1020, 62
    elif budget_per_page >= 40_000:
        w, q = 840, 50
    elif budget_per_page >= 24_000:
        w, q = 640, 38
    else:
        w, q = 500, 32

    for _ in range(4):
        est = _estimate_raster_size(doc, w, q, boost)
        if est <= max_bytes * 0.92:
            break
        ratio = (max_bytes * 0.88) / max(1, est)
        w = max(220, int(w * (ratio ** 0.45)))
        q = max(14, q - 6)

    out_bytes = _render_raster_pdf(doc, w, q, boost)
    attempts = 0
    while len(out_bytes) > max_bytes and attempts < 7:
        attempts += 1
        ratio = (max_bytes * 0.87) / len(out_bytes)
        w = max(220, int(w * (ratio ** 0.5)))
        q = max(12, q - 5)
        out_bytes = _render_raster_pdf(doc, w, q, boost)

    doc.close()
    if len(out_bytes) > max_bytes:
        return {
            "ok": False,
            "error": f"still_too_large:{len(out_bytes)}",
            "in_bytes": in_size,
            "pages": n_pages,
        }

    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with open(out_path, "wb") as f:
        f.write(out_bytes)
    return {
        "ok": True,
        "bytes": len(out_bytes),
        "in_bytes": in_size,
        "pages": n_pages,
        "method": f"raster_w{w}_q{q}",
        "text": preview_text,
    }


def handle_request(req: dict) -> dict:
    op = req.get("op")
    max_mb = float(req.get("max_mb", 9.5))
    if op == "download_gdrive":
        return download_gdrive_to_file(req["file_id"], req["out_path"], int(req.get("timeout", 180)))
    elif op == "jpg2pdf":
        return image_to_pdf(req["in_path"], req["out_path"], max_mb)
    elif op == "compress":
        return compress_and_inspect_pdf(req["in_path"], req["out_path"], max_mb)
    elif op == "ping":
        return {"ok": True}
    else:
        return {"ok": False, "error": f"unknown_op:{op}"}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--server", action="store_true", help="Run JSONL stdin/stdout server loop")
    parser.add_argument("--op", choices=["download_gdrive", "jpg2pdf", "compress"])
    parser.add_argument("--in-path")
    parser.add_argument("--out-path")
    parser.add_argument("--file-id")
    parser.add_argument("--max-mb", type=float, default=9.5)
    args = parser.parse_args()

    if args.server:
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            req_id = None
            try:
                req = json.loads(line)
                req_id = req.get("req_id")
                res = handle_request(req)
            except Exception as e:
                res = {"ok": False, "error": f"{type(e).__name__}: {e}"}
            if req_id is not None:
                res["req_id"] = req_id
            print(json.dumps(res, ensure_ascii=False), flush=True)
    else:
        res = handle_request(
            {
                "op": args.op,
                "in_path": args.in_path,
                "out_path": args.out_path,
                "file_id": args.file_id,
                "max_mb": args.max_mb,
            }
        )
        print(json.dumps(res, ensure_ascii=False), flush=True)
        if not res.get("ok"):
            sys.exit(1)


if __name__ == "__main__":
    main()
