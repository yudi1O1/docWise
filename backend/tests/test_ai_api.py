from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_ai_edit_endpoint_success() -> None:
    fake_response_data = {
        "document_html": "<p><strong>Updated AI Content</strong></p>",
        "message": "Success",
    }

    mock_urlopen = MagicMock()
    mock_urlopen.__enter__.return_value.read.return_value = b'{"document_html": "<p><strong>Updated AI Content</strong></p>", "message": "Success"}'

    with patch("urllib.request.urlopen", return_value=mock_urlopen):
        response = client.post(
            "/api/ai/edit",
            json={
                "session_id": "test-session-123",
                "message": "Make headings bold",
                "document_html": "<p>Original Content</p>",
            },
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["document_html"] == "<p><strong>Updated AI Content</strong></p>"
