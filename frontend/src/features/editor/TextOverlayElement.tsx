import { ChangeEvent, useLayoutEffect, useRef } from "react";

import { pageToCssRect } from "../../lib/coordinates";
import type { TextElement } from "../../types/document";
import { useDocumentSession } from "../document-session/store";

interface TextOverlayElementProps {
  element: TextElement;
  pageNumber?: number;
}

const MIN_PARAGRAPH_WIDTH = 260;
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
  const isModifiedExisting = !element.source.isNew && element.content !== (element.source.originalText ?? "");
  const isReflowedExisting =
    !element.source.isNew && Math.abs(element.y - (element.source.originalY ?? element.y)) > LAYOUT_EPSILON;
  const shouldShowModification = element.source.isNew || isModifiedExisting || isReflowedExisting || selected;
  const shouldUseParagraphWidth = isModifiedExisting || element.source.isNew;
  const sourceBelongsToRenderedPage = pageNumber === undefined || element.source.pageNumber === pageNumber;
  const editorWidth = shouldUseParagraphWidth
    ? Math.max(rect.width, sourceRect.width, MIN_PARAGRAPH_WIDTH, 24)
    : Math.max(rect.width, sourceRect.width, 24);
  const editorHeight = Math.max(rect.height, sourceRect.height, element.fontSize * zoom * 1.4);
  const minimumEditorHeight = Math.max(sourceRect.height, element.fontSize * zoom * 1.4);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!selected || !textarea || (!isModifiedExisting && !element.source.isNew)) {
      return;
    }
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

  if (mode !== "quick-edit") {
    return null;
  }

  const onChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    updateText(element.id, event.target.value);
  };

  const sharedStyle = {
    left: rect.x,
    top: rect.y,
    width: `min(${editorWidth}px, calc(100% - ${rect.x}px))`,
    maxWidth: `calc(100% - ${rect.x}px)`,
    height: editorHeight,
    fontSize: element.fontSize * zoom,
    color: element.color,
    fontFamily: "Arial, sans-serif",
    textAlign: element.alignment,
    lineHeight: "1.2",
    overflowWrap: "break-word",
    whiteSpace: "pre-wrap",
  } as const;

  const maskStyle = {
    left: sourceRect.x,
    top: sourceRect.y,
    width: Math.max(sourceRect.width, 1),
    height: Math.max(sourceRect.height, element.fontSize * zoom * 1.4),
  };

  if (!shouldShowModification) {
    return (
      <button
        type="button"
        className={`absolute cursor-text border bg-transparent outline-none ${
          selected ? "border-accent ring-2 ring-accent/25" : "border-transparent hover:border-accent/60"
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
        aria-label={`Select text region: ${element.content}`}
        data-testid="text-hit-region"
      />
    );
  }

  const commonPreviewClasses = `absolute box-border whitespace-pre-wrap break-words border bg-white p-0 leading-tight outline-none ${
    selected ? "border-accent ring-2 ring-accent/25" : "border-transparent"
  }`;

  if (!selected) {
    return (
      <>
        {!element.source.isNew && sourceBelongsToRenderedPage && (
          <div className="absolute bg-white" style={maskStyle} aria-hidden data-testid="text-source-mask" />
        )}
        <div className={commonPreviewClasses} style={sharedStyle} data-testid="modified-text-preview">
          {element.content}
        </div>
      </>
    );
  }

  return (
    <>
      {!element.source.isNew && sourceBelongsToRenderedPage && (
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
        className="absolute box-border resize-none overflow-hidden break-words border border-accent bg-white p-0 leading-tight outline-none ring-2 ring-accent/25"
        style={sharedStyle}
        aria-label="Editable PDF text"
        data-testid={element.source.isNew ? "new-text-editor" : "active-text-editor"}
      />
    </>
  );
}
