import { describe, expect, it } from "vitest";

import { structuredDocumentToExportModel } from "./exportModel";
import type { DocumentModel, StructuredDocument } from "../../types/document";

const fallbackDocument: DocumentModel = {
  sourceType: "pdf",
  fileName: "sample.pdf",
  pageCount: 1,
  pages: [
    {
      pageNumber: 1,
      width: 612,
      height: 792,
      elements: [],
    },
  ],
};

describe("structuredDocumentToExportModel", () => {
  it("lays out edited document text in page flow instead of original PDF coordinates", () => {
    const structuredDocument: StructuredDocument = {
      id: "structured-sample",
      fileName: "sample.pdf",
      pages: [{ pageNumber: 1, width: 612, height: 792 }],
      content: [
        {
          id: "paragraph-1",
          type: "paragraph",
          content: [{ type: "text", text: "Edited text" }],
          style: { fontSize: 14, fontFamily: "Helvetica", fontWeight: "normal" },
          sourcePage: 1,
          sourceBounds: { x: 40, y: 80, width: 180, height: 24 },
          sourceText: "Original text",
        },
      ],
    };

    const exportModel = structuredDocumentToExportModel(structuredDocument, fallbackDocument);
    const element = exportModel.pages[0].elements[0];

    expect(element.content).toBe("Edited text");
    expect(element.x).toBe(48);
    expect(element.y).toBe(48);
    expect(element.width).toBe(516);
    expect(element.source.originalText).toBe("Original text");
    expect(element.source.originalX).toBe(40);
    expect(element.source.isNew).toBe(false);
  });

  it("pushes later paragraphs downward when an earlier paragraph becomes long", () => {
    const longText = Array.from({ length: 60 }, (_, index) => `word${index}`).join(" ");
    const structuredDocument: StructuredDocument = {
      id: "structured-sample",
      fileName: "sample.pdf",
      pages: [{ pageNumber: 1, width: 612, height: 792 }],
      content: [
        {
          id: "paragraph-1",
          type: "paragraph",
          content: [{ type: "text", text: longText }],
          style: { fontSize: 14 },
          sourcePage: 1,
          sourceBounds: { x: 40, y: 80, width: 180, height: 24 },
          sourceText: "Short original",
        },
        {
          id: "paragraph-2",
          type: "paragraph",
          content: [{ type: "text", text: "Second paragraph" }],
          style: { fontSize: 14 },
          sourcePage: 1,
          sourceBounds: { x: 40, y: 108, width: 180, height: 24 },
          sourceText: "Second paragraph",
        },
      ],
    };

    const exportModel = structuredDocumentToExportModel(structuredDocument, fallbackDocument);
    const [first, second] = exportModel.pages[0].elements;

    expect(first.height).toBeGreaterThan(24);
    expect(second.y).toBeGreaterThan(first.y + first.height);
    expect(second.y).not.toBe(108);
  });

  it("adds flow pages when edited content exceeds the original page height", () => {
    const structuredDocument: StructuredDocument = {
      id: "structured-sample",
      fileName: "sample.pdf",
      pages: [{ pageNumber: 1, width: 612, height: 160 }],
      content: Array.from({ length: 10 }, (_, index) => ({
        id: `paragraph-${index}`,
        type: "paragraph",
        content: [{ type: "text" as const, text: "A paragraph with enough words to consume vertical space on a short page." }],
        style: { fontSize: 14 },
      })),
    };

    const exportModel = structuredDocumentToExportModel(structuredDocument, {
      ...fallbackDocument,
      pages: [{ pageNumber: 1, width: 612, height: 160, elements: [] }],
    });

    expect(exportModel.pageCount).toBeGreaterThan(1);
    expect(exportModel.pages.at(-1)?.elements.length).toBeGreaterThan(0);
  });

  it("splits a single long paragraph across pages instead of creating one clipped textbox", () => {
    const structuredDocument: StructuredDocument = {
      id: "structured-sample",
      fileName: "sample.pdf",
      pages: [{ pageNumber: 1, width: 612, height: 180 }],
      content: [
        {
          id: "paragraph-1",
          type: "paragraph",
          content: [{ type: "text", text: Array.from({ length: 220 }, (_, index) => `word${index}`).join(" ") }],
          style: { fontSize: 14 },
        },
      ],
    };

    const exportModel = structuredDocumentToExportModel(structuredDocument, {
      ...fallbackDocument,
      pages: [{ pageNumber: 1, width: 612, height: 180, elements: [] }],
    });

    expect(exportModel.pageCount).toBeGreaterThan(1);
    expect(exportModel.pages.flatMap((page) => page.elements).length).toBeGreaterThan(1);
    expect(exportModel.pages.flatMap((page) => page.elements).every((element) => element.y + element.height <= 180 - 48 + 1)).toBe(true);
  });

  it("continues long lists onto additional pages without dropping items", () => {
    const structuredDocument: StructuredDocument = {
      id: "structured-sample",
      fileName: "sample.pdf",
      pages: [{ pageNumber: 1, width: 612, height: 180 }],
      content: [
        {
          id: "list-1",
          type: "bulletList",
          items: Array.from({ length: 18 }, (_, index) => ({
            id: `item-${index}`,
            content: [{ type: "text" as const, text: `List item ${index + 1}` }],
            style: { fontSize: 14 },
          })),
          style: { fontSize: 14 },
        },
      ],
    };

    const exportModel = structuredDocumentToExportModel(structuredDocument, {
      ...fallbackDocument,
      pages: [{ pageNumber: 1, width: 612, height: 180, elements: [] }],
    });
    const exportedText = exportModel.pages.flatMap((page) => page.elements.map((element) => element.content)).join("\n");

    expect(exportModel.pageCount).toBeGreaterThan(1);
    expect(exportedText).toContain("* List item 1");
    expect(exportedText).toContain("* List item 18");
  });
});
