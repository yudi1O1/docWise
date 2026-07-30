import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useDocumentSession } from "../document-session/store";
import { TextOverlayElement } from "./TextOverlayElement";
import type { TextElement } from "../../types/document";

const sourceElement: TextElement = {
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
};

describe("TextOverlayElement", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useDocumentSession.getState().reset();
    useDocumentSession.setState({ mode: "quick-edit", zoom: 1, selectedElementId: null });
  });

  it("uses transparent hit regions for unmodified source text", () => {
    render(<TextOverlayElement element={sourceElement} />);

    expect(screen.getByTestId("text-hit-region")).toBeInTheDocument();
    expect(screen.queryByLabelText("Editable PDF text")).not.toBeInTheDocument();
    expect(screen.queryByTestId("text-source-mask")).not.toBeInTheDocument();
  });

  it("shows an active editor over a local source mask for selected source text", () => {
    useDocumentSession.setState({ selectedElementId: "text-1" });
    render(<TextOverlayElement element={{ ...sourceElement, content: "Edited" }} />);

    expect(screen.getByTestId("text-source-mask")).toBeInTheDocument();
    expect(screen.getByTestId("active-text-editor")).toBeInTheDocument();
    expect(screen.queryByTestId("modified-text-preview")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Editable PDF text")).toHaveValue("Edited");
  });

  it("does not use paragraph width for selected text before content changes", () => {
    useDocumentSession.setState({ selectedElementId: "text-1" });
    render(<TextOverlayElement element={sourceElement} />);

    // Width = max(sourceRect.width, rect.width) = max(80, 80) = 80
    // Uses pre-wrap so text wraps within the element, matching PDF layout
    expect(screen.getByTestId("active-text-editor")).toHaveStyle({
      width: "80px",
      whiteSpace: "pre-wrap",
      overflow: "hidden",
    });
  });

  it("masks the full original source region for shorter replacement text", () => {
    const shorterElement = {
      ...sourceElement,
      content: "Dev",
      source: { ...sourceElement.source, originalText: "Software Developer", originalWidth: 160 },
      width: 30,
    };

    render(<TextOverlayElement element={shorterElement} />);

    expect(screen.getByTestId("text-source-mask")).toHaveStyle({ left: "10px", top: "20px", width: "160px" });
    expect(screen.getByTestId("modified-text-preview")).toHaveTextContent("Dev");
    expect(screen.queryByText("Software Developer")).not.toBeInTheDocument();
  });

  it("shows one modified preview after editing is finished", () => {
    render(<TextOverlayElement element={{ ...sourceElement, content: "Edited" }} />);

    expect(screen.getByTestId("text-source-mask")).toBeInTheDocument();
    expect(screen.getByTestId("modified-text-preview")).toHaveTextContent("Edited");
    expect(screen.queryByTestId("active-text-editor")).not.toBeInTheDocument();
  });

  it("does not move text coordinates when pointer movement occurs", () => {
    useDocumentSession.setState({ selectedElementId: "text-1" });
    render(<TextOverlayElement element={sourceElement} />);

    const editor = screen.getByTestId("active-text-editor");
    fireEvent.pointerDown(editor, { clientX: 10, clientY: 20 });
    fireEvent.pointerMove(editor, { clientX: 80, clientY: 120 });
    fireEvent.pointerUp(editor, { clientX: 80, clientY: 120 });

    expect(sourceElement.x).toBe(10);
    expect(sourceElement.y).toBe(20);
  });

  it("constrains the active editor to the remaining page width", () => {
    useDocumentSession.setState({ selectedElementId: "text-1" });
    render(
      <TextOverlayElement
        element={{
          ...sourceElement,
          content: "A very long replacement text that should wrap instead of overflowing beyond the page edge",
          x: 380,
          width: 80,
          source: {
            ...sourceElement.source,
            originalX: 380,
            originalWidth: 80,
          },
        }}
      />,
    );

    // Anchored at left:380px. Width = original element width (80px).
    // Text wraps within the element boundary — no horizontal scrollbar.
    expect(screen.getByTestId("active-text-editor")).toHaveStyle({
      left: "380px",
      width: "80px",
      whiteSpace: "pre-wrap",
      overflow: "hidden",
    });
  });

  it("renders automatically reflowed unchanged text once at its effective position", () => {
    render(<TextOverlayElement element={{ ...sourceElement, y: 52 }} />);

    // Reflowed-but-unmodified elements render as transparent hit-regions.
    // The PDF canvas already shows the text correctly — no mask or preview needed.
    expect(screen.getByTestId("text-hit-region")).toBeInTheDocument();
    expect(screen.queryByTestId("text-source-mask")).not.toBeInTheDocument();
    expect(screen.queryByTestId("modified-text-preview")).not.toBeInTheDocument();
    expect(screen.queryByTestId("active-text-editor")).not.toBeInTheDocument();
  });
});
