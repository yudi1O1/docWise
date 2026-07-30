import { ChangeEvent, useLayoutEffect, useRef } from "react";

import { pageToCssRect } from "../../lib/coordinates";
import type { TextElement } from "../../types/document";
import { useDocumentSession } from "../document-session/store";

interface TextOverlayElementProps {
  element: TextElement;
  pageNumber?: number;
}

const LAYOUT_EPSILON = 0.75;

export function TextOverlayElement({ element, pageNumber }: TextOverlayElementProps) {
  const mode = useDocumentSession((state) => state.mode);
  const zoom = useDocumentSession((state) => state.zoom);
  const selectedElementId = useDocumentSession((state) => state.selectedElementId);
  const selectElement = useDocumentSession((state) => state.selectElement);
  const updateText = useDocumentSession((state) => state.updateText);
  const updateTextHeight = useDocumentSession((state) => state.updateTextHeight);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const rect = pageToCssRect(element, zoom);
  const selected = selectedElementId === element.id;

  const sourceRect = pageToCssRect(
    {
      x: element.source.originalX ?? element.x,
      y: element.source.originalY ?? element.y,
      width: element.source.originalWidth ?? element.width,
      height: element.source.originalHeight ?? element.height,
    },
    zoom,
  );

  const isModifiedExisting =
    !element.source.isNew && element.content !== (element.source.originalText ?? "");

  // Only show mask + replacement text when the user has ACTUALLY changed content.
  // Reflowed-but-unedited elements remain as transparent hit-regions — the PDF
  // canvas renders them correctly without any overlay interference.
  const shouldShowModification = element.source.isNew || isModifiedExisting || selected;
  const sourceBelongsToRenderedPage =
    pageNumber === undefined || element.source.pageNumber === pageNumber;

  // Use the source (original PDF) width as the authoritative display width.
  // This ensures text wraps exactly as in the original PDF — no horizontal overflow.
  const displayWidth = Math.max(sourceRect.width, rect.width, 24);
  const editorHeight = Math.max(rect.height, sourceRect.height, element.fontSize * zoom * 1.15);
  const minimumEditorHeight = Math.max(sourceRect.height, element.fontSize * zoom * 1.15);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!selected || !textarea || (!isModifiedExisting && !element.source.isNew)) {
      return;
    }
    // Auto-grow height for multi-line content
    textarea.style.height = "auto";
    const measuredHeight = Math.max(textarea.scrollHeight, minimumEditorHeight);
    textarea.style.height = `${measuredHeight}px`;
    const pageHeight = measuredHeight / zoom;
    const pageWidth = textarea.getBoundingClientRect().width / zoom;
    if (Math.abs(pageHeight - element.height) > 0.5 || Math.abs(pageWidth - element.width) > 0.5) {
      updateTextHeight(element.id, pageHeight, pageWidth);
    }
  }, [
    element.content,
    element.height,
    element.id,
    element.source.isNew,
    element.width,
    isModifiedExisting,
    minimumEditorHeight,
    selected,
    updateTextHeight,
    zoom,
  ]);

  if (mode !== "document-edit" && mode !== "quick-edit") {
    return null;
  }

  const onChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    updateText(element.id, event.target.value);
  };

  /**
   * Shared typography — mirrors exactly what the PDF glyph looks like.
   * - `whiteSpace: "pre-wrap"` preserves original line breaks, wraps at container width
   * - `overflowWrap: "break-word"` prevents overflow beyond the element width
   * - Width is clamped to the original PDF element width so nothing extends off-page
   * - No padding — shifts text away from its PDF coordinate origin
   */
  const sharedTypography = {
    fontSize: element.fontSize * zoom,
    fontFamily: element.fontFamily || "Inter, Arial, sans-serif",
    fontWeight: element.fontWeight,
    fontStyle: element.fontStyle ?? "normal",
    color: element.color,
    textAlign: element.alignment,
    lineHeight: "1.15",
    whiteSpace: "pre-wrap" as const,
    overflowWrap: "break-word" as const,
    padding: 0,
    margin: 0,
  };

  // ── Hit region (unmodified text) ──────────────────────────────────────────
  // Transparent clickable zone over the PDF canvas text.
  // NO background — canvas shows through perfectly.
  if (!shouldShowModification) {
    return (
      <button
        type="button"
        className={`absolute cursor-text bg-transparent outline-none transition-colors ${
          selected
            ? "border border-accent ring-1 ring-accent/20"
            : "border border-transparent hover:border-accent/40"
        }`}
        style={{
          left: sourceRect.x,
          top: sourceRect.y,
          width: Math.max(sourceRect.width, 24),
          height: Math.max(sourceRect.height, element.fontSize * zoom * 1.4),
        }}
        onClick={(event) => {
          event.stopPropagation();
          selectElement(element.id);
        }}
        aria-label={`Edit text: ${element.content.slice(0, 60)}`}
        data-testid="text-hit-region"
      />
    );
  }

  const maskStyle = {
    left: sourceRect.x,
    top: sourceRect.y,
    width: Math.max(sourceRect.width, 1),
    height: Math.max(sourceRect.height, element.fontSize * zoom * 1.15),
  };

  // Only mask the original PDF canvas text when the content has actually changed.
  // Before any typing, the PDF canvas text should still show through.
  const shouldMaskSource = sourceBelongsToRenderedPage && !element.source.isNew && isModifiedExisting;

  // ── Modified text preview (not active/selected) ───────────────────────────
  if (!selected) {
    return (
      <>
        {shouldMaskSource && (
          <div className="absolute bg-white" style={maskStyle} aria-hidden data-testid="text-source-mask" />
        )}
        <div
          className="absolute box-border overflow-hidden p-0 leading-tight"
          style={{
            left: rect.x,
            top: rect.y,
            width: displayWidth,
            height: editorHeight,
            background: "white",
            ...sharedTypography,
          }}
          data-testid="modified-text-preview"
        >
          {element.content}
        </div>
      </>
    );
  }

  // ── Active textarea (being edited) ────────────────────────────────────────
  // The white mask only covers the original PDF canvas text if content has changed.
  // Before the user types, the textarea is transparent so the canvas text shows
  // through — the user can see what they're editing without a blank white box.
  return (
    <>
      {shouldMaskSource && (
        <div className="absolute bg-white" style={maskStyle} aria-hidden data-testid="text-source-mask" />
      )}
      <textarea
        ref={textareaRef}
        autoFocus
        rows={1}
        value={element.content}
        onMouseDown={(event) => event.stopPropagation()}
        onChange={onChange}
        onBlur={() => window.setTimeout(() => selectElement(null), 0)}
        className="absolute box-border resize-none border border-accent p-0 leading-tight outline-none ring-1 ring-accent/20"
        style={{
          left: rect.x,
          top: rect.y,
          width: displayWidth,
          height: editorHeight,
          overflow: "hidden",
          // Transparent until typing starts — canvas text shows through
          background: isModifiedExisting ? "white" : "transparent",
          ...sharedTypography,
          // When transparent, set color to transparent too so canvas text isn't
          // doubled by the textarea text on top
          color: isModifiedExisting ? element.color : "transparent",
        }}
        aria-label="Editable PDF text"
        data-testid={element.source.isNew ? "new-text-editor" : "active-text-editor"}
      />
    </>
  );
}
