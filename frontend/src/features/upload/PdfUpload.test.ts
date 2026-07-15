import { describe, expect, it } from "vitest";

import { validatePdfFile } from "./validation";

describe("validatePdfFile", () => {
  it("accepts a non-empty PDF file", () => {
    const file = new File(["%PDF-"], "sample.pdf", { type: "application/pdf" });

    expect(validatePdfFile(file)).toBeNull();
  });

  it("rejects missing, empty, oversized, and non-PDF files", () => {
    expect(validatePdfFile(undefined)).toBe("Please upload a PDF file.");
    expect(validatePdfFile(new File([], "empty.pdf", { type: "application/pdf" }))).toBe("This PDF is empty.");
    expect(validatePdfFile(new File(["12345"], "large.pdf", { type: "application/pdf" }), 2)).toBe("This file is too large.");
    expect(validatePdfFile(new File(["hello"], "notes.txt", { type: "text/plain" }))).toBe("Please upload a PDF file.");
  });
});
