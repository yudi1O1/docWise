import { beforeEach, describe, expect, it } from "vitest";

import { useDocumentSession } from "./store";
import type { DocumentModel } from "../../types/document";

const sampleDocument: DocumentModel = {
  sourceType: "pdf",
  fileName: "sample.pdf",
  pageCount: 1,
  pages: [
    {
      pageNumber: 1,
      width: 300,
      height: 200,
      elements: [
        {
          id: "text-1",
          type: "text",
          content: "Original",
          x: 10,
          y: 20,
          width: 80,
          height: 20,
          fontSize: 12,
          fontFamily: "helv",
          fontWeight: "normal",
          color: "#000000",
          alignment: "left",
          rotation: 0,
          source: {
            pageNumber: 1,
            originalText: "Original",
            originalX: 10,
            originalY: 20,
            originalWidth: 80,
            originalHeight: 20,
            isNew: false,
          },
        },
      ],
    },
  ],
};

describe("document session store", () => {
  beforeEach(() => {
    useDocumentSession.getState().reset();
  });

  it("keeps edits in undo and redo stacks", () => {
    const file = new File(["%PDF-"], "sample.pdf", { type: "application/pdf" });
    useDocumentSession.getState().loadDocument(file, sampleDocument);
    useDocumentSession.getState().updateText("text-1", "Edited");

    expect(useDocumentSession.getState().document?.pages[0].elements[0].content).toBe("Edited");

    useDocumentSession.getState().undo();
    expect(useDocumentSession.getState().document?.pages[0].elements[0].content).toBe("Original");

    useDocumentSession.getState().redo();
    expect(useDocumentSession.getState().document?.pages[0].elements[0].content).toBe("Edited");
  });

  it("keeps deleted source text as a redact-only export element", () => {
    const file = new File(["%PDF-"], "sample.pdf", { type: "application/pdf" });
    useDocumentSession.getState().loadDocument(file, sampleDocument);
    useDocumentSession.getState().selectElement("text-1");
    useDocumentSession.getState().deleteSelectedElement();

    const element = useDocumentSession.getState().document?.pages[0].elements[0];
    expect(element?.content).toBe("");
    expect(element?.source.isNew).toBe(false);
  });

  it("does not expose V1 text movement", () => {
    const file = new File(["%PDF-"], "sample.pdf", { type: "application/pdf" });
    useDocumentSession.getState().loadDocument(file, sampleDocument);

    expect("moveElement" in useDocumentSession.getState()).toBe(false);
    expect(useDocumentSession.getState().document?.pages[0].elements[0].x).toBe(10);
    expect(useDocumentSession.getState().document?.pages[0].elements[0].y).toBe(20);
  });

  it("derives downstream reflow from measured edited text height", () => {
    const file = new File(["%PDF-"], "sample.pdf", { type: "application/pdf" });
    useDocumentSession.getState().loadDocument(file, {
      ...sampleDocument,
      pages: [
        {
          ...sampleDocument.pages[0],
          elements: [
            sampleDocument.pages[0].elements[0],
            {
              ...sampleDocument.pages[0].elements[0],
              id: "text-2",
              content: "Second",
              y: 50,
              source: {
                ...sampleDocument.pages[0].elements[0].source,
                originalText: "Second",
                originalY: 50,
              },
            },
          ],
        },
      ],
    });

    useDocumentSession.getState().updateText("text-1", "Long first line");
    useDocumentSession.getState().updateTextHeight("text-1", 50);

    expect(useDocumentSession.getState().document?.pages[0].elements[0].y).toBe(20);
    expect(useDocumentSession.getState().document?.pages[0].elements[1].y).toBe(80);

    useDocumentSession.getState().updateTextHeight("text-1", 20);
    expect(useDocumentSession.getState().document?.pages[0].elements[1].y).toBe(50);
  });

  it("keeps redo available after measurement-only reflow following undo", () => {
    const file = new File(["%PDF-"], "sample.pdf", { type: "application/pdf" });
    useDocumentSession.getState().loadDocument(file, sampleDocument);
    useDocumentSession.getState().updateText("text-1", "Edited");
    useDocumentSession.getState().undo();
    useDocumentSession.getState().updateTextHeight("text-1", 20);

    expect(useDocumentSession.getState().redoStack).toHaveLength(1);
    useDocumentSession.getState().redo();
    expect(useDocumentSession.getState().document?.pages[0].elements[0].content).toBe("Edited");
  });

  it("creates a structured document when entering Document Edit mode", () => {
    const file = new File(["%PDF-"], "sample.pdf", { type: "application/pdf" });
    useDocumentSession.getState().loadDocument(file, sampleDocument);
    useDocumentSession.getState().setMode("document-edit");

    expect(useDocumentSession.getState().mode).toBe("document-edit");
    expect(useDocumentSession.getState().structuredDocument?.content[0]).toMatchObject({
      type: "paragraph",
      content: [{ type: "text", text: "Original" }],
    });
  });
});
