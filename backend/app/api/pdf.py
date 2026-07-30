import json

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import ValidationError

from app.models.document import DocumentModel
from app.services.pdf_service import (
    PdfProcessingError,
    convert_pdf_to_docx,
    export_pdf,
    parse_pdf,
    validate_pdf_upload,
)

router = APIRouter(tags=["pdf"])


@router.post("/parse", response_model=DocumentModel)
async def parse(file: UploadFile = File(...)) -> DocumentModel:
    pdf_bytes = await file.read()
    try:
        validate_pdf_upload(file.filename, file.content_type, pdf_bytes)
        return parse_pdf(pdf_bytes, file.filename or "document.pdf")
    except PdfProcessingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.public_message) from exc


@router.post("/export")
async def export(
    file: UploadFile = File(...),
    document: str = Form(...),
) -> StreamingResponse:
    pdf_bytes = await file.read()
    try:
        validate_pdf_upload(file.filename, file.content_type, pdf_bytes)
        document_model = DocumentModel.model_validate(json.loads(document))
        exported = export_pdf(pdf_bytes, document_model)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail="Malformed document payload.") from exc
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail="Invalid document model.") from exc
    except PdfProcessingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.public_message) from exc

    output_name = safe_download_name(document_model.file_name)
    return StreamingResponse(
        iter([exported]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{output_name}"'},
    )


@router.post("/to-docx")
async def to_docx(file: UploadFile = File(...)) -> StreamingResponse:
    pdf_bytes = await file.read()
    try:
        validate_pdf_upload(file.filename, file.content_type, pdf_bytes)
        docx_bytes = convert_pdf_to_docx(pdf_bytes)
    except PdfProcessingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.public_message) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to convert PDF to DOCX.") from exc

    output_name = safe_docx_name(file.filename or "document.pdf")
    return StreamingResponse(
        iter([docx_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{output_name}"'},
    )


def safe_download_name(file_name: str) -> str:
    stem = file_name.rsplit(".", 1)[0] if "." in file_name else file_name
    cleaned = "".join(char for char in stem if char.isalnum() or char in ("-", "_")).strip()
    return f"{cleaned or 'document'}-edited.pdf"


def safe_docx_name(file_name: str) -> str:
    stem = file_name.rsplit(".", 1)[0] if "." in file_name else file_name
    cleaned = "".join(char for char in stem if char.isalnum() or char in ("-", "_")).strip()
    return f"{cleaned or 'document'}.docx"
