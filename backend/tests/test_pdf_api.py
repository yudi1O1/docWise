from io import BytesIO

import fitz
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import get_settings


client = TestClient(app)


def make_pdf(text: str = "Hello docWise") -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=300, height=200)
    page.insert_text((40, 80), text, fontsize=14)
    output = BytesIO()
    doc.save(output)
    doc.close()
    return output.getvalue()


def make_encrypted_pdf() -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=300, height=200)
    page.insert_text((40, 80), "Secret", fontsize=14)
    output = BytesIO()
    doc.save(
        output,
        encryption=fitz.PDF_ENCRYPT_AES_256,
        owner_pw="owner-password",
        user_pw="user-password",
    )
    doc.close()
    return output.getvalue()


def test_health() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_parse_valid_pdf() -> None:
    response = client.post(
        "/api/pdf/parse",
        files={"file": ("sample.pdf", make_pdf(), "application/pdf")},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["sourceType"] == "pdf"
    assert payload["pageCount"] == 1
    assert payload["pages"][0]["elements"][0]["content"] == "Hello docWise"


def test_reject_invalid_pdf() -> None:
    response = client.post(
        "/api/pdf/parse",
        files={"file": ("sample.pdf", b"not a pdf", "application/pdf")},
    )
    assert response.status_code == 400


def test_reject_empty_pdf_upload() -> None:
    response = client.post(
        "/api/pdf/parse",
        files={"file": ("empty.pdf", b"", "application/pdf")},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "The uploaded file is empty."


def test_reject_renamed_non_pdf_file() -> None:
    response = client.post(
        "/api/pdf/parse",
        files={"file": ("renamed.pdf", b"not actually a pdf", "application/pdf")},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "The uploaded file is not a valid PDF."


def test_reject_wrong_extension_even_with_pdf_bytes() -> None:
    response = client.post(
        "/api/pdf/parse",
        files={"file": ("sample.txt", make_pdf(), "application/pdf")},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Only PDF files are supported."


def test_reject_wrong_content_type() -> None:
    response = client.post(
        "/api/pdf/parse",
        files={"file": ("sample.pdf", make_pdf(), "text/plain")},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Unsupported file type."


def test_reject_corrupted_pdf() -> None:
    response = client.post(
        "/api/pdf/parse",
        files={"file": ("corrupt.pdf", b"%PDF-1.7\nthis is not readable", "application/pdf")},
    )
    assert response.status_code == 400
    assert response.json()["detail"] in {"The PDF could not be opened.", "The PDF could not be processed."}


def test_reject_password_protected_pdf() -> None:
    response = client.post(
        "/api/pdf/parse",
        files={"file": ("encrypted.pdf", make_encrypted_pdf(), "application/pdf")},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Password-protected PDFs are not supported."


def test_reject_oversized_pdf(monkeypatch) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "max_upload_bytes", 4)
    response = client.post(
        "/api/pdf/parse",
        files={"file": ("sample.pdf", make_pdf(), "application/pdf")},
    )
    assert response.status_code == 413


def test_export_pdf() -> None:
    original = make_pdf()
    parsed = client.post(
        "/api/pdf/parse",
        files={"file": ("sample.pdf", original, "application/pdf")},
    ).json()
    parsed["pages"][0]["elements"][0]["content"] = "Edited text"

    response = client.post(
        "/api/pdf/export",
        files={"file": ("sample.pdf", original, "application/pdf")},
        data={"document": __import__("json").dumps(parsed)},
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF-")
    exported = fitz.open(stream=response.content, filetype="pdf")
    exported_text = exported[0].get_text()
    exported.close()
    assert "Edited text" in exported_text
    assert "Hello docWise" not in exported_text


def test_export_rejects_malformed_document_payload() -> None:
    response = client.post(
        "/api/pdf/export",
        files={"file": ("sample.pdf", make_pdf(), "application/pdf")},
        data={"document": "{not-json"},
    )
    assert response.status_code == 422


def test_export_updated_text_leaves_unrelated_content() -> None:
    original = make_pdf("Software Developer")
    parsed = client.post(
        "/api/pdf/parse",
        files={"file": ("sample.pdf", original, "application/pdf")},
    ).json()
    parsed["pages"][0]["elements"][0]["content"] = "Dev"

    response = client.post(
        "/api/pdf/export",
        files={"file": ("sample.pdf", original, "application/pdf")},
        data={"document": __import__("json").dumps(parsed)},
    )

    assert response.status_code == 200
    exported = fitz.open(stream=response.content, filetype="pdf")
    exported_text = exported[0].get_text()
    exported.close()
    assert "Dev" in exported_text
    assert "Software Developer" not in exported_text


def test_export_deleted_text_redacts_original() -> None:
    original = make_pdf("Remove me")
    parsed = client.post(
        "/api/pdf/parse",
        files={"file": ("sample.pdf", original, "application/pdf")},
    ).json()
    parsed["pages"][0]["elements"][0]["content"] = ""

    response = client.post(
        "/api/pdf/export",
        files={"file": ("sample.pdf", original, "application/pdf")},
        data={"document": __import__("json").dumps(parsed)},
    )

    exported = fitz.open(stream=response.content, filetype="pdf")
    assert "Remove me" not in exported[0].get_text()


def test_export_allows_reflow_onto_added_page() -> None:
    original = make_pdf("Move me")
    parsed = client.post(
        "/api/pdf/parse",
        files={"file": ("sample.pdf", original, "application/pdf")},
    ).json()
    moved = parsed["pages"][0]["elements"][0]
    parsed["pageCount"] = 2
    parsed["pages"][0]["elements"] = []
    parsed["pages"].append(
        {
            "pageNumber": 2,
            "width": parsed["pages"][0]["width"],
            "height": parsed["pages"][0]["height"],
            "elements": [{**moved, "y": 40}],
        }
    )

    response = client.post(
        "/api/pdf/export",
        files={"file": ("sample.pdf", original, "application/pdf")},
        data={"document": __import__("json").dumps(parsed)},
    )

    assert response.status_code == 200
    exported = fitz.open(stream=response.content, filetype="pdf")
    assert exported.page_count == 2
    assert "Move me" not in exported[0].get_text()
    assert "Move me" in exported[1].get_text()
    exported.close()
