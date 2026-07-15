import type { DocumentModel } from "../types/document";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

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
