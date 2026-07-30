import json
import logging
from typing import Any
import urllib.error
import urllib.request

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.core.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["ai"])


class AiEditRequest(BaseModel):
    session_id: str = Field(..., alias="session_id")
    message: str = Field(...)
    document_html: str = Field(..., alias="document_html")

    model_config = {"populate_by_name": True}


class AiEditResponse(BaseModel):
    document_html: str = Field(alias="document_html")
    message: str | None = None
    raw: dict[str, Any] | None = None

    model_config = {"populate_by_name": True}


@router.post("/edit", response_model=AiEditResponse)
async def ai_edit(payload: AiEditRequest) -> AiEditResponse:
    settings = get_settings()
    api_key = settings.superdocs_api_key or "sk_f7567f632a8dd893b6cc213ce6b6cbe3"

    target_url = "https://api.superdocs.app/v1/chat"
    request_body = json.dumps(
        {
            "session_id": payload.session_id,
            "message": payload.message,
            "document_html": payload.document_html,
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        target_url,
        data=request_body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "docWise-API",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=45) as response:
            res_body = response.read().decode("utf-8")
            logger.info("[SuperDocs] Raw response body: %s", res_body[:2000])
            data = json.loads(res_body) if res_body.strip().startswith("{") else {"response": res_body}
            logger.info("[SuperDocs] Parsed response keys: %s", list(data.keys()) if isinstance(data, dict) else type(data).__name__)

            # SuperDocs API shape:
            # { response: "...", session_id: "...", document_changes: { updated_html: "..." }, usage: {...} }
            document_changes = data.get("document_changes") or {}
            updated_html = (
                document_changes.get("updated_html")
                or document_changes.get("html")
                or data.get("document_html")
                or data.get("html")
                or payload.document_html
            )

            choices_content = None
            choices = data.get("choices")
            if isinstance(choices, list) and len(choices) > 0:
                choice = choices[0]
                if isinstance(choice, dict):
                    msg = choice.get("message")
                    choices_content = msg.get("content") if isinstance(msg, dict) else choice.get("text")

            message_text = (
                data.get("response")
                or data.get("message")
                or data.get("reply")
                or data.get("summary")
                or data.get("output")
                or data.get("text")
                or data.get("content")
                or (document_changes.get("changes_summary") if document_changes else None)
                or choices_content
                or None
            )
            logger.info("[SuperDocs] Extracted message: %s | html_changed: %s", bool(message_text), updated_html != payload.document_html)
            return AiEditResponse(document_html=updated_html, message=message_text, raw=data if isinstance(data, dict) else None)
    except urllib.error.HTTPError as exc:
        err_msg = exc.read().decode("utf-8", errors="ignore")
        raise HTTPException(status_code=exc.code, detail=f"SuperDocs API error: {exc.reason} - {err_msg}") from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to communicate with SuperDocs API: {exc}") from exc
