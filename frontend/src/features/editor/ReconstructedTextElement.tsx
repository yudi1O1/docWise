import { useRef, useEffect, KeyboardEvent } from "react";
import type { TextElement } from "../../types/document";
import { useDocumentSession } from "../document-session/store";

interface ReconstructedTextElementProps {
  element: TextElement;
  zoom: number;
  /** Pre-computed reflow-adjusted top position in CSS px. When provided this
   *  replaces `element.y * zoom` so gaps from deleted elements are closed. */
  adjustedTop?: number;
}

/**
 * Strips legacy **bold** markdown markers that may exist in stored content
 * from before the backend was updated to emit plain text.
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1") // **bold** → bold
    .replace(/\*([^*]+)\*/g, "$1")      // *italic* → italic
    .replace(/__([^_]+)__/g, "$1")      // __bold__ → bold
    .replace(/_([^_]+)_/g, "$1");       // _italic_ → italic
}

export function ReconstructedTextElement({
  element,
  zoom,
  adjustedTop,
}: ReconstructedTextElementProps) {
  const mode = useDocumentSession((state) => state.mode);
  const selectedElementId = useDocumentSession((state) => state.selectedElementId);
  const selectElement = useDocumentSession((state) => state.selectElement);
  const updateText = useDocumentSession((state) => state.updateText);

  const ref = useRef<HTMLDivElement>(null);
  const isEditable = mode === "document-edit" || mode === "quick-edit";
  const isSelected = selectedElementId === element.id;
  const isMultiLine = element.content.includes("\n");

  const displayContent = stripMarkdown(element.content);

  // ── CRITICAL: Uncontrolled contentEditable pattern ────────────────────────
  //
  // We do NOT pass children through JSX. If we did, every React re-render
  // (e.g. when isSelected flips on click) would call el.textContent = value,
  // resetting the cursor to position 0.
  //
  // Instead, we set textContent imperatively:
  //   • On mount: always seed the initial content.
  //   • On external change (e.g. AI edit): update only if not currently focused.
  //
  // This means the cursor stays exactly where the user clicked.

  // Seed content on mount only
  useEffect(() => {
    if (ref.current) {
      ref.current.textContent = displayContent;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external changes (e.g. from AI rewrite) without resetting cursor
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Don't touch the DOM while the user is actively editing this element
    if (document.activeElement === el) return;
    // Only update if the content actually changed
    if (el.textContent !== displayContent) {
      el.textContent = displayContent;
    }
  }, [displayContent]);

  const handleInput = () => {
    const text = ref.current?.textContent ?? "";
    updateText(element.id, text);
  };

  const handleFocus = () => selectElement(element.id);

  const handleBlur = () => setTimeout(() => selectElement(null), 80);

  // ── Empty element guard ───────────────────────────────────────────────────
  // When the user deletes all text from an element and clicks away, the element
  // should vanish completely so no blank space remains.
  // While the element is selected (user is still editing), we keep it visible
  // so they can type into it.
  const isEmpty = !element.content.trim();
  if (isEmpty && !isSelected) {
    return null;
  }

  // Prevent Enter from inserting a <div> or <br> — insert a literal newline char
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      document.execCommand("insertText", false, "\n");
    }
  };

  return (
    <div
      ref={ref}
      // ── No JSX children! ────────────────────────────────────────────────
      // Content is set imperatively above via useEffect.
      // Passing children here would cause React to overwrite textContent
      // on every re-render, resetting the cursor.
      contentEditable={isEditable}
      suppressContentEditableWarning
      onInput={handleInput}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onMouseDown={(e) => e.stopPropagation()}
      data-testid={`text-element-${element.id}`}
      style={{
        // ── Position ────────────────────────────────────────────────
        position: "absolute",
        left: element.x * zoom,
        // Use pre-computed reflow position when available (collapses gaps from
        // deleted elements above this one), otherwise fall back to PDF coords.
        top: adjustedTop ?? element.y * zoom,

        // Width strategy:
        //  • Multi-line paragraphs: constrain to PDF width so wrapping
        //    happens at the correct column.
        //  • Single-line labels/headings: min-width only — browser font metrics
        //    may render text slightly wider than the PDF; a hard clamp truncates.
        width: isMultiLine ? element.width * zoom : undefined,
        minWidth: element.width * zoom,
        minHeight: element.height * zoom,

        // ── Typography ──────────────────────────────────────────────────────
        fontSize: element.fontSize * zoom,
        fontFamily: element.fontFamily
          ? `"${element.fontFamily}", Inter, Arial, sans-serif`
          : "Inter, Arial, sans-serif",
        fontWeight: element.fontWeight,
        fontStyle: element.fontStyle ?? "normal",
        color: element.color,
        textAlign: element.alignment,
        lineHeight: 1.2,

        // Wrapping:
        //  • Multi-line: pre-wrap preserves \n and wraps at element width
        //  • Single-line: nowrap — text extends right without wrapping
        whiteSpace: isMultiLine ? "pre-wrap" : "nowrap",
        wordBreak: isMultiLine ? "break-word" : "normal",
        overflowWrap: isMultiLine ? "break-word" : "normal",

        // ── Editor chrome ───────────────────────────────────────────────────
        outline: "none",
        padding: 0,
        margin: 0,
        cursor: isEditable ? "text" : "default",
        userSelect: isEditable ? "text" : "none",
        WebkitUserSelect: isEditable ? "text" : "none",
        background: "transparent",

        // Border highlight in edit mode
        border: isEditable
          ? isSelected
            ? "1px solid rgba(36,107,92,0.75)"
            : "1px solid transparent"
          : "none",
        borderRadius: 2,

        boxShadow:
          isSelected && isEditable
            ? "0 0 0 2px rgba(36,107,92,0.12)"
            : "none",

        transition: "border-color 0.1s, box-shadow 0.1s",
      }}
      className={isEditable && !isSelected ? "docwise-text-hover" : ""}
    />
  );
}
