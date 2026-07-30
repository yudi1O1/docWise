import { useState } from "react";
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
  { label: "Inter", value: "Inter" },
  { label: "Arial", value: "Arial" },
  { label: "Times New Roman", value: "Times New Roman" },
  { label: "Georgia", value: "Georgia" },
  { label: "Courier New", value: "Courier New" },
  { label: "Helvetica", value: "Helvetica" },
  { label: "Verdana", value: "Verdana" },
  { label: "Trebuchet MS", value: "Trebuchet MS" },
];

const FONT_SIZES = [6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48, 56, 64, 72];

const COLORS = [
  "#17202a", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6",
  "#ec4899", "#14b8a6", "#3eadb0", "#64748b", "#ffffff",
  "#dc2626", "#2563eb", "#16a34a", "#d97706", "#7c3aed", "#db2777",
  "#0891b2", "#65a30d", "#b91c1c", "#1d4ed8", "#15803d", "#b45309",
];

function getFocusedFontSize(): number {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return 12;
  const size = parseFloat(window.getComputedStyle(el).fontSize);
  return isNaN(size) ? 12 : Math.round(size);
}

function applyFontSize(px: number) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || selection.isCollapsed) return;
  document.execCommand("fontSize", false, "7");
  const els = document.querySelectorAll('font[size="7"]');
  els.forEach((el) => {
    const span = document.createElement("span");
    span.style.fontSize = `${px}px`;
    while (el.firstChild) span.appendChild(el.firstChild);
    el.replaceWith(span);
  });
}

/**
 * FormatRibbon — always-visible text formatting bar in edit mode.
 * Sits between the main toolbar and the document area.
 */
export function FormatRibbon() {
  const mode = useDocumentSession((state) => state.mode);
  const [fontSize, setFontSize] = useState<number>(12);
  const [showColorPicker, setShowColorPicker] = useState(false);

  if (mode !== "document-edit" && mode !== "quick-edit") return null;

  const preventBlur = (e: React.MouseEvent) => e.preventDefault();

  const handleFontSizeChange = (next: number) => {
    const clamped = Math.max(6, Math.min(128, next));
    setFontSize(clamped);
    applyFontSize(clamped);
  };

  const cmd = (command: string, value?: string) => {
    document.execCommand(command, false, value);
  };

  return (
    <div
      className="flex min-w-0 flex-wrap items-center gap-1 border-b border-line bg-white px-3 py-1.5"
      onMouseDown={preventBlur}
      role="toolbar"
      aria-label="Format ribbon"
    >
      {/* ── Font Family ─────────────────────────────────────────── */}
      <select
        defaultValue=""
        onChange={(e) => {
          if (e.target.value) cmd("fontName", e.target.value);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className="h-7 w-36 rounded border border-line bg-paper px-1.5 text-xs font-medium text-ink focus:outline-none focus:ring-1 focus:ring-accent"
        title="Font family"
      >
        <option value="" disabled>Font family</option>
        {FONT_FAMILIES.map((f) => (
          <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
            {f.label}
          </option>
        ))}
      </select>

      <div className="h-5 w-px bg-line" />

      {/* ── Font Size ───────────────────────────────────────────── */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            handleFontSizeChange((getFocusedFontSize() || fontSize) - 1);
          }}
          className="flex h-7 w-7 items-center justify-center rounded border border-line bg-paper text-ink/60 hover:bg-accent/10 hover:text-accent transition-colors"
          title="Decrease size"
        >
          <Minus className="h-3 w-3" />
        </button>

        <select
          value={fontSize}
          onChange={(e) => handleFontSizeChange(Number(e.target.value))}
          onMouseDown={(e) => e.stopPropagation()}
          onFocus={() => setFontSize(getFocusedFontSize() || fontSize)}
          className="h-7 w-14 rounded border border-line bg-paper text-center text-xs font-bold text-ink focus:outline-none focus:ring-1 focus:ring-accent"
          title="Font size"
        >
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            handleFontSizeChange((getFocusedFontSize() || fontSize) + 1);
          }}
          className="flex h-7 w-7 items-center justify-center rounded border border-line bg-paper text-ink/60 hover:bg-accent/10 hover:text-accent transition-colors"
          title="Increase size"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      <div className="h-5 w-px bg-line" />

      {/* ── Bold / Italic / Underline / Strikethrough ───────────── */}
      {[
        { icon: <Bold className="h-3.5 w-3.5" />, command: "bold", title: "Bold (Ctrl+B)", label: "B" },
        { icon: <Italic className="h-3.5 w-3.5" />, command: "italic", title: "Italic (Ctrl+I)", label: "I" },
        { icon: <Underline className="h-3.5 w-3.5" />, command: "underline", title: "Underline (Ctrl+U)", label: "U" },
        { icon: <Strikethrough className="h-3.5 w-3.5" />, command: "strikeThrough", title: "Strikethrough", label: "S" },
      ].map(({ icon, command, title }) => (
        <button
          key={command}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            cmd(command);
          }}
          className="flex h-7 w-7 items-center justify-center rounded border border-line bg-paper text-ink/70 hover:bg-accent/10 hover:text-accent hover:border-accent/40 transition-colors"
          title={title}
        >
          {icon}
        </button>
      ))}

      <div className="h-5 w-px bg-line" />

      {/* ── Alignment ───────────────────────────────────────────── */}
      {[
        { icon: <AlignLeft className="h-3.5 w-3.5" />, command: "justifyLeft", title: "Align left" },
        { icon: <AlignCenter className="h-3.5 w-3.5" />, command: "justifyCenter", title: "Align center" },
        { icon: <AlignRight className="h-3.5 w-3.5" />, command: "justifyRight", title: "Align right" },
      ].map(({ icon, command, title }) => (
        <button
          key={command}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            cmd(command);
          }}
          className="flex h-7 w-7 items-center justify-center rounded border border-line bg-paper text-ink/70 hover:bg-accent/10 hover:text-accent hover:border-accent/40 transition-colors"
          title={title}
        >
          {icon}
        </button>
      ))}

      <div className="h-5 w-px bg-line" />

      {/* ── Color Picker ────────────────────────────────────────── */}
      <div className="relative">
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            setShowColorPicker((v) => !v);
          }}
          className="flex h-7 w-7 items-center justify-center rounded border border-line bg-paper text-ink/70 hover:bg-accent/10 hover:text-accent hover:border-accent/40 transition-colors"
          title="Text color"
        >
          <Baseline className="h-3.5 w-3.5" />
        </button>

        {showColorPicker && (
          <div
            className="absolute left-0 top-full z-50 mt-1 rounded-xl border border-line bg-white p-2.5 shadow-xl ring-1 ring-black/5"
            onMouseDown={(e) => e.preventDefault()}
          >
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink/40">Text color</p>
            <div className="grid grid-cols-7 gap-1.5">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    cmd("foreColor", color);
                    setShowColorPicker(false);
                  }}
                  className="h-5 w-5 rounded transition-transform hover:scale-125"
                  style={{
                    backgroundColor: color,
                    outline: color === "#ffffff" ? "1px solid #e2ddd6" : "1px solid rgba(0,0,0,0.1)",
                    outlineOffset: "1px",
                  }}
                  title={color}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Hint ────────────────────────────────────────────────── */}
      <span className="ml-auto text-[10px] text-ink/30 select-none hidden sm:block">
        Select text to apply formatting
      </span>
    </div>
  );
}
