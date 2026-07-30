import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Minus,
  Plus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Baseline,
} from "lucide-react";
import { useDocumentSession } from "../document-session/store";

const FONT_FAMILIES = [
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
  { label: "Helvetica", value: "Helvetica, sans-serif" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
];

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64];

interface ToolbarPosition {
  top: number;
  left: number;
}

function getSelectionFontSize(): number | null {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  const container = range.startContainer;
  const el =
    container.nodeType === Node.TEXT_NODE
      ? container.parentElement
      : (container as Element);
  if (!el) return null;
  const size = parseFloat(window.getComputedStyle(el).fontSize);
  return isNaN(size) ? null : Math.round(size);
}

function applyFontSize(px: number) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || selection.isCollapsed) return;

  // Use execCommand with a temporary marker, then replace with styled span
  document.execCommand("fontSize", false, "7");
  const fontEls = document.querySelectorAll('font[size="7"]');
  fontEls.forEach((el) => {
    const span = document.createElement("span");
    span.style.fontSize = `${px}px`;
    el.replaceWith(span);
    while (el.firstChild) span.appendChild(el.firstChild);
  });
}

function applyFontFamily(family: string) {
  document.execCommand("fontName", false, family);
}

function applyColor(color: string) {
  document.execCommand("foreColor", false, color);
}

export function FloatingFormatToolbar() {
  const mode = useDocumentSession((state) => state.mode);
  const [position, setPosition] = useState<ToolbarPosition | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [currentFontSize, setCurrentFontSize] = useState<number>(14);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();

      if (!selection || selection.isCollapsed || !selection.rangeCount) {
        setPosition(null);
        setShowColorPicker(false);
        setShowFontPicker(false);
        return;
      }

      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;

      // Only show toolbar when selection is inside a contentEditable element
      const node =
        container.nodeType === Node.TEXT_NODE
          ? container.parentElement
          : (container as Element);
      const editable = node?.closest('[contenteditable="true"]');
      if (!editable) {
        setPosition(null);
        return;
      }

      const rect = range.getBoundingClientRect();
      const scrollEl = document.querySelector("section[aria-label='Document workspace']");
      const scrollTop = scrollEl?.scrollTop ?? 0;
      const scrollLeft = scrollEl?.scrollLeft ?? 0;
      const sectionRect = scrollEl?.getBoundingClientRect();

      setPosition({
        // Position above the selection, relative to the scroll container
        top: rect.top - (sectionRect?.top ?? 0) + scrollTop - 52,
        left: rect.left - (sectionRect?.left ?? 0) + scrollLeft + rect.width / 2,
      });

      setCurrentFontSize(getSelectionFontSize() ?? 14);
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  if (!position || mode !== "document-edit") return null;

  // Prevent blur/deselection when clicking toolbar buttons
  const preventBlur = (e: React.MouseEvent) => e.preventDefault();

  const changeFontSize = (delta: number) => {
    const next = Math.max(6, Math.min(128, currentFontSize + delta));
    setCurrentFontSize(next);
    applyFontSize(next);
  };

  return (
    <div
      ref={toolbarRef}
      onMouseDown={preventBlur}
      style={{
        position: "absolute",
        top: Math.max(4, position.top),
        left: position.left,
        transform: "translateX(-50%)",
        zIndex: 9999,
      }}
      className="flex items-center gap-0.5 rounded-xl border border-line bg-white px-1.5 py-1 shadow-xl shadow-black/10 ring-1 ring-black/5"
      role="toolbar"
      aria-label="Text formatting"
    >
      {/* Font Family */}
      <div className="relative">
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            setShowFontPicker((v) => !v);
            setShowColorPicker(false);
          }}
          className="flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-ink hover:bg-paper transition-colors"
          title="Font family"
        >
          <span className="max-w-[72px] truncate">Font</span>
          <span className="text-ink/40">▾</span>
        </button>

        {showFontPicker && (
          <div className="absolute left-0 top-full mt-1 z-50 w-44 rounded-xl border border-line bg-white py-1 shadow-xl">
            {FONT_FAMILIES.map((f) => (
              <button
                key={f.value}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyFontFamily(f.value);
                  setShowFontPicker(false);
                }}
                className="block w-full px-3 py-1.5 text-left text-xs text-ink hover:bg-paper transition-colors"
                style={{ fontFamily: f.value }}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mx-1 h-5 w-px bg-line" />

      {/* Font Size */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); changeFontSize(-1); }}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-ink/60 hover:bg-paper hover:text-ink transition-colors"
          title="Decrease font size"
        >
          <Minus className="h-3 w-3" />
        </button>

        <select
          value={currentFontSize}
          onChange={(e) => {
            const size = Number(e.target.value);
            setCurrentFontSize(size);
            applyFontSize(size);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="h-7 w-12 rounded border border-line bg-paper text-center text-[11px] font-bold text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          title="Font size"
        >
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); changeFontSize(1); }}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-ink/60 hover:bg-paper hover:text-ink transition-colors"
          title="Increase font size"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      <div className="mx-1 h-5 w-px bg-line" />

      {/* Bold / Italic / Underline / Strikethrough */}
      {[
        { icon: <Bold className="h-3.5 w-3.5" />, cmd: "bold", title: "Bold (Ctrl+B)" },
        { icon: <Italic className="h-3.5 w-3.5" />, cmd: "italic", title: "Italic (Ctrl+I)" },
        { icon: <Underline className="h-3.5 w-3.5" />, cmd: "underline", title: "Underline (Ctrl+U)" },
        { icon: <Strikethrough className="h-3.5 w-3.5" />, cmd: "strikeThrough", title: "Strikethrough" },
      ].map(({ icon, cmd, title }) => (
        <button
          key={cmd}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            document.execCommand(cmd);
          }}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-ink/70 hover:bg-paper hover:text-ink transition-colors"
          title={title}
        >
          {icon}
        </button>
      ))}

      <div className="mx-1 h-5 w-px bg-line" />

      {/* Alignment */}
      {[
        { icon: <AlignLeft className="h-3.5 w-3.5" />, cmd: "justifyLeft", title: "Align left" },
        { icon: <AlignCenter className="h-3.5 w-3.5" />, cmd: "justifyCenter", title: "Align center" },
        { icon: <AlignRight className="h-3.5 w-3.5" />, cmd: "justifyRight", title: "Align right" },
      ].map(({ icon, cmd, title }) => (
        <button
          key={cmd}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            document.execCommand(cmd);
          }}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-ink/70 hover:bg-paper hover:text-ink transition-colors"
          title={title}
        >
          {icon}
        </button>
      ))}

      <div className="mx-1 h-5 w-px bg-line" />

      {/* Color picker */}
      <div className="relative">
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            setShowColorPicker((v) => !v);
            setShowFontPicker(false);
          }}
          className="flex h-7 w-7 flex-col items-center justify-center gap-0.5 rounded-lg hover:bg-paper transition-colors"
          title="Text color"
        >
          <Baseline className="h-3.5 w-3.5 text-ink/70" />
        </button>

        {showColorPicker && (
          <div className="absolute right-0 top-full mt-1 z-50 rounded-xl border border-line bg-white p-2 shadow-xl">
            <div className="grid grid-cols-7 gap-1">
              {[
                "#17202a", "#ef4444", "#f97316", "#eab308",
                "#22c55e", "#3b82f6", "#8b5cf6",
                "#ec4899", "#14b8a6", "#3eadb0", "#64748b",
                "#ffffff", "#e2e8f0", "#94a3b8", "#000000",
                "#dc2626", "#2563eb", "#16a34a", "#d97706",
                "#7c3aed", "#db2777", "#0891b2", "#65a30d",
                "#b91c1c", "#1d4ed8", "#15803d", "#b45309",
              ].map((color) => (
                <button
                  key={color}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applyColor(color);
                    setShowColorPicker(false);
                  }}
                  className="h-5 w-5 rounded-md border border-white/50 shadow-xs hover:scale-110 transition-transform"
                  style={{ backgroundColor: color, outline: "1px solid rgba(0,0,0,0.12)" }}
                  title={color}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
