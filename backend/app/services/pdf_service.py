from hashlib import sha256
from io import BytesIO

import fitz
from fastapi import status

from app.core.config import get_settings
from app.models.document import DocumentModel, ElementSource, PageModel, TextElement


PDF_CONTENT_TYPES = {"application/pdf", "application/octet-stream", "binary/octet-stream"}


class PdfProcessingError(Exception):
    def __init__(self, public_message: str, status_code: int = status.HTTP_400_BAD_REQUEST) -> None:
        super().__init__(public_message)
        self.public_message = public_message
        self.status_code = status_code


def validate_pdf_upload(file_name: str | None, content_type: str | None, data: bytes) -> None:
    settings = get_settings()
    if not data:
        raise PdfProcessingError("The uploaded file is empty.")
    if len(data) > settings.max_upload_bytes:
        raise PdfProcessingError("The uploaded file is larger than the configured limit.", status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)
    if file_name and not file_name.lower().endswith(".pdf"):
        raise PdfProcessingError("Only PDF files are supported.")
    if content_type and content_type not in PDF_CONTENT_TYPES:
        raise PdfProcessingError("Unsupported file type.")
    if not data.startswith(b"%PDF-"):
        raise PdfProcessingError("The uploaded file is not a valid PDF.")


def parse_pdf(data: bytes, file_name: str) -> DocumentModel:
    try:
        with fitz.open(stream=data, filetype="pdf") as doc:
            if doc.is_encrypted:
                raise PdfProcessingError("Password-protected PDFs are not supported.")
            if doc.page_count == 0:
                raise PdfProcessingError("The PDF does not contain any pages.")
            if doc.page_count > get_settings().max_page_count:
                raise PdfProcessingError("The PDF has more pages than this workspace currently supports.")

            pages = [_parse_page(page, page_index + 1) for page_index, page in enumerate(doc)]
            return DocumentModel(
                sourceType="pdf",
                fileName=file_name,
                pageCount=doc.page_count,
                pages=pages,
            )
    except PdfProcessingError:
        raise
    except fitz.FileDataError as exc:
        raise PdfProcessingError("The PDF could not be opened.") from exc
    except RuntimeError as exc:
        raise PdfProcessingError("The PDF could not be processed.") from exc


def export_pdf(original_data: bytes, document: DocumentModel) -> bytes:
    try:
        with fitz.open(stream=original_data, filetype="pdf") as doc:
            if doc.is_encrypted:
                raise PdfProcessingError("Password-protected PDFs are not supported.")
            if document.page_count < doc.page_count:
                raise PdfProcessingError("The edit model does not match the uploaded PDF.", status.HTTP_422_UNPROCESSABLE_ENTITY)
            _ensure_export_pages(doc, document)

            _apply_source_redactions(doc, document)
            for page_model in document.pages:
                page = doc[page_model.page_number - 1]
                _draw_page_edits(page, page_model.elements)

            output = BytesIO()
            doc.save(output, garbage=4, deflate=True)
            return output.getvalue()
    except PdfProcessingError:
        raise
    except fitz.FileDataError as exc:
        raise PdfProcessingError("The PDF could not be opened.") from exc
    except RuntimeError as exc:
        raise PdfProcessingError("The PDF could not be exported.") from exc


def _parse_page(page: fitz.Page, page_number: int) -> PageModel:
    page_dict = page.get_text("dict")
    elements: list[TextElement] = []

    for block_index, block in enumerate(page_dict.get("blocks", [])):
        if block.get("type") != 0:
            continue
        elements.extend(_parse_text_block(block, page_number, block_index))

    return PageModel(pageNumber=page_number, width=page.rect.width, height=page.rect.height, elements=elements)


def _parse_text_block(block: dict, page_number: int, block_index: int) -> list[TextElement]:
    lines = [_line_payload(line) for line in block.get("lines", [])]
    lines = [line for line in lines if line is not None]
    if not lines:
        return []

    grouped: list[list[dict]] = []
    current: list[dict] = []
    for line in lines:
        if current and not _belongs_to_same_edit_block(current[-1], line):
            grouped.append(current)
            current = []
        current.append(line)
    if current:
        grouped.append(current)

    return [_text_element_from_lines(group, page_number, block_index, group_index) for group_index, group in enumerate(grouped)]


def _line_payload(line: dict) -> dict | None:
    spans = line.get("spans", [])
    if not spans:
        return None
    content = "".join(span.get("text", "") for span in spans).strip()
    if not content:
        return None

    x0, y0, x1, y1 = line.get("bbox", [0, 0, 0, 0])
    first_span = spans[0]
    font_size = float(first_span.get("size") or 12)
    font_name = str(first_span.get("font") or "helv")
    return {
        "content": content,
        "x0": float(x0),
        "y0": float(y0),
        "x1": float(x1),
        "y1": float(y1),
        "font_size": font_size,
        "font_family": font_name,
        "font_weight": "bold" if "bold" in font_name.lower() else "normal",
        "font_style": "italic" if any(token in font_name.lower() for token in ("italic", "oblique")) else "normal",
        "color": _int_color_to_hex(int(first_span.get("color") or 0)),
    }


def _belongs_to_same_edit_block(previous: dict, current: dict) -> bool:
    line_gap = current["y0"] - previous["y1"]
    max_font_size = max(previous["font_size"], current["font_size"])
    if line_gap < -1 or line_gap > max(10, max_font_size * 0.9):
        return False
    if abs(current["font_size"] - previous["font_size"]) > 1:
        return False
    if current["font_weight"] != previous["font_weight"]:
        return False
    if current["font_style"] != previous["font_style"]:
        return False
    if current["color"] != previous["color"]:
        return False

    left_delta = abs(current["x0"] - previous["x0"])
    hanging_indent = current["x0"] > previous["x0"] and left_delta <= max(36, max_font_size * 3)
    return left_delta <= max(8, max_font_size * 0.7) or hanging_indent


def _text_element_from_lines(lines: list[dict], page_number: int, block_index: int, group_index: int) -> TextElement:
    content = "\n".join(line["content"] for line in lines)
    x0 = min(line["x0"] for line in lines)
    y0 = min(line["y0"] for line in lines)
    x1 = max(line["x1"] for line in lines)
    y1 = max(line["y1"] for line in lines)
    first_line = lines[0]
    digest = sha256(f"{page_number}:{block_index}:{group_index}:{content}:{x0}:{y0}".encode("utf-8")).hexdigest()[:16]
    return TextElement(
        id=f"p{page_number}-t{digest}",
        content=content,
        x=x0,
        y=y0,
        width=max(0, x1 - x0),
        height=max(0, y1 - y0),
        fontSize=first_line["font_size"],
        fontFamily=first_line["font_family"],
        fontWeight=first_line["font_weight"],
        fontStyle=first_line["font_style"],
        color=first_line["color"],
        alignment="left",
        rotation=0,
        source=ElementSource(
            pageNumber=page_number,
            originalText=content,
            originalX=x0,
            originalY=y0,
            originalWidth=max(0, x1 - x0),
            originalHeight=max(0, y1 - y0),
            isNew=False,
        ),
    )


def _ensure_export_pages(doc: fitz.Document, document: DocumentModel) -> None:
    for page_model in sorted(document.pages, key=lambda page: page.page_number):
        while doc.page_count < page_model.page_number:
            doc.new_page(width=page_model.width, height=page_model.height)


def _apply_source_redactions(doc: fitz.Document, document: DocumentModel) -> None:
    redacted_pages: set[int] = set()
    for page_model in document.pages:
        for element in page_model.elements:
            if not _should_redact_original(element):
                continue
            source_page_number = element.source.page_number
            if source_page_number > doc.page_count:
                continue
            page = doc[source_page_number - 1]
            page.add_redact_annot(_original_rect(element), fill=(1, 1, 1))
            redacted_pages.add(source_page_number)

    for page_number in redacted_pages:
        doc[page_number - 1].apply_redactions()


def _draw_page_edits(page: fitz.Page, elements: list[TextElement]) -> None:
    for element in elements:
        if not element.content or not _should_draw_element(element):
            continue
        rect = fitz.Rect(element.x, element.y, element.x + max(element.width, 8), element.y + max(element.height, element.font_size * 2.2))
        page.insert_textbox(
            rect,
            element.content,
            fontsize=element.font_size,
            fontname=_pdf_font_name(element),
            color=_hex_to_rgb(element.color),
            align=_alignment(element.alignment),
            rotate=int(element.rotation) if element.rotation in {0, 90, 180, 270} else 0,
        )


def _int_color_to_hex(value: int) -> str:
    return f"#{value & 0xFFFFFF:06x}"


def _hex_to_rgb(value: str) -> tuple[float, float, float]:
    cleaned = value.strip().lstrip("#")
    if len(cleaned) != 6:
        return (0, 0, 0)
    try:
        return tuple(int(cleaned[index : index + 2], 16) / 255 for index in (0, 2, 4))  # type: ignore[return-value]
    except ValueError:
        return (0, 0, 0)


def _pdf_font_name(element: TextElement) -> str:
    return "hebo" if element.font_weight == "bold" else "helv"


def _alignment(alignment: str) -> int:
    return {"left": 0, "center": 1, "right": 2}.get(alignment, 0)


def _should_redact_original(element: TextElement) -> bool:
    if element.source.is_new or element.source.original_text is None:
        return False
    return (
        element.content != element.source.original_text
        or element.x != element.source.original_x
        or element.y != element.source.original_y
        or element.width != element.source.original_width
        or element.height != element.source.original_height
    )


def _should_draw_element(element: TextElement) -> bool:
    return element.source.is_new or _should_redact_original(element)


def _original_rect(element: TextElement) -> fitz.Rect:
    x = element.source.original_x if element.source.original_x is not None else element.x
    y = element.source.original_y if element.source.original_y is not None else element.y
    width = element.source.original_width if element.source.original_width is not None else element.width
    height = element.source.original_height if element.source.original_height is not None else element.height
    return fitz.Rect(x, y, x + width, y + height)
