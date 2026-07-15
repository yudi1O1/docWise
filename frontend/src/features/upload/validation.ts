const DEFAULT_MAX_CLIENT_SIZE = 25 * 1024 * 1024;

export function validatePdfFile(file: File | undefined, maxBytes = DEFAULT_MAX_CLIENT_SIZE): string | null {
  if (!file) {
    return "Please upload a PDF file.";
  }
  if (file.size === 0) {
    return "This PDF is empty.";
  }
  if (file.size > maxBytes) {
    return "This file is too large.";
  }
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return "Please upload a PDF file.";
  }
  if (file.type && file.type !== "application/pdf" && file.type !== "application/octet-stream") {
    return "Please upload a PDF file.";
  }
  return null;
}
