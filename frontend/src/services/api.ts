import type { DocumentModel } from "../types/document";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? "http://localhost:8000" : "");

async function parseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: string };
    return payload.detail ?? "Request failed.";
  } catch {
    return "Request failed.";
  }
}

export async function parsePdf(file: File): Promise<DocumentModel> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_BASE_URL}/api/pdf/parse`, {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as DocumentModel;
}

export async function exportPdf(file: File, document: DocumentModel): Promise<Blob> {
  const form = new FormData();
  form.append("file", file);
  form.append("document", JSON.stringify(document));
  const response = await fetch(`${API_BASE_URL}/api/pdf/export`, {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return await response.blob();
}

export async function exportDocx(file: File): Promise<Blob> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_BASE_URL}/api/pdf/to-docx`, {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return await response.blob();
}

export interface SuperDocsEditPayload {
  session_id: string;
  message: string;
  document_html: string;
}

export interface SuperDocsAiResponse {
  document_html: string;
  message?: string;
}

export async function sendSuperDocsAiEdit(payload: SuperDocsEditPayload): Promise<SuperDocsAiResponse> {
  const apiKey = import.meta.env.VITE_SUPERDOCS_API_KEY ?? "sk_f7567f632a8dd893b6cc213ce6b6cbe3";

  // Always call the backend proxy first (handles CORS + auth server-side)
  try {
    const response = await fetch(`${API_BASE_URL}/api/ai/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      const resData = (await response.json()) as Record<string, unknown>;
      console.log("[SuperDocs] Backend proxy response:", resData);
      return extractSuperDocsResponse(resData, payload.document_html);
    }
    console.warn("[SuperDocs] Backend proxy failed with status:", response.status);
  } catch (err) {
    console.warn("[SuperDocs] Backend proxy error:", err);
  }

  // Direct fallback (only used if backend is unreachable)
  console.log("[SuperDocs] Falling back to direct API call...");
  const directResponse = await fetch("https://api.superdocs.app/v1/chat", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session_id: payload.session_id,
      message: payload.message,
      document_html: payload.document_html,
    }),
  });

  if (!directResponse.ok) {
    const errText = await directResponse.text();
    console.error("[SuperDocs] Direct API error:", directResponse.status, errText);
    throw new Error(`SuperDocs API error ${directResponse.status}: ${errText}`);
  }

  const data = (await directResponse.json()) as Record<string, unknown>;
  console.log("[SuperDocs] Direct API response:", data);
  return extractSuperDocsResponse(data, payload.document_html);
}

function extractSuperDocsResponse(data: Record<string, unknown>, fallbackHtml: string): SuperDocsAiResponse {
  // SuperDocs API response shape:
  // { response: "...", session_id: "...", document_changes: { updated_html: "..." }, usage: {...}, hint: null }
  const documentChanges = data["document_changes"] as Record<string, unknown> | undefined;

  const updatedHtml =
    (documentChanges?.["updated_html"] as string | undefined) ||
    (documentChanges?.["html"] as string | undefined) ||
    (data["document_html"] as string | undefined) ||
    (data["html"] as string | undefined) ||
    ((data["data"] as Record<string, unknown> | undefined)?.["document_html"] as string | undefined) ||
    fallbackHtml;

  // Text reply is in the top-level "response" field
  const choices = data["choices"] as Array<Record<string, unknown>> | undefined;
  const choiceContent =
    choices?.[0] &&
    ((choices[0]["message"] as Record<string, unknown> | undefined)?.["content"] as string | undefined ||
      (choices[0]["text"] as string | undefined));

  const message =
    (data["response"] as string | undefined) ||
    (data["message"] as string | undefined) ||
    (data["reply"] as string | undefined) ||
    (data["summary"] as string | undefined) ||
    (data["output"] as string | undefined) ||
    (data["text"] as string | undefined) ||
    (data["content"] as string | undefined) ||
    (documentChanges?.["changes_summary"] as string | undefined) ||
    choiceContent ||
    undefined;

  return { document_html: updatedHtml, message };
}
