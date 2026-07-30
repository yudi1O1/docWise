import { useState } from "react";
import { ChevronDown, Download, Edit3, Eye, FileText, FileType, Minus, Plus, RotateCcw, RotateCw, Trash2, Upload } from "lucide-react";

import { useExportPdf } from "../export/useExportPdf";
import { useExportDocx } from "../export/useExportDocx";
import { useDocumentSession } from "../document-session/store";
import { DocWiseFullLogo, DocWiseLogo } from "./DocWiseLogo";

export function Toolbar() {
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const mode = useDocumentSession((state) => state.mode);
  const zoom = useDocumentSession((state) => state.zoom);
  const document = useDocumentSession((state) => state.document);
  const structuredDocument = useDocumentSession((state) => state.structuredDocument);
  const undoStack = useDocumentSession((state) => state.undoStack);
  const redoStack = useDocumentSession((state) => state.redoStack);
  const selectedElementId = useDocumentSession((state) => state.selectedElementId);
  const setMode = useDocumentSession((state) => state.setMode);
  const setZoom = useDocumentSession((state) => state.setZoom);
  const undo = useDocumentSession((state) => state.undo);
  const redo = useDocumentSession((state) => state.redo);
  const reset = useDocumentSession((state) => state.reset);
  const deleteSelectedElement = useDocumentSession((state) => state.deleteSelectedElement);
  const exportMutation = useExportPdf();
  const exportDocxMutation = useExportDocx();

  const handleDownloadTxt = () => {
    if (!document) return;
    let text = "";
    if (structuredDocument) {
      text = structuredDocument.content
        .map((node) => {
          if ("content" in node && Array.isArray(node.content)) {
            return node.content.map((c) => ("text" in c ? c.text : "")).join("");
          }
          return "";
        })
        .filter(Boolean)
        .join("\n\n");
    } else {
      text = document.pages.flatMap((p) => p.elements.map((e) => e.content)).join("\n\n");
    }
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `${document.fileName.replace(/\.[^/.]+$/, "") || "document"}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    setIsDownloadOpen(false);
  };

  return (
    <header className="flex min-w-0 items-center justify-between gap-3 border-b border-line bg-white px-4 py-2 shadow-xs">
      {/* Left Brand & File Name */}
      <div className="flex items-center gap-3">
        <div className="border-r border-line pr-3 flex items-center">
          <DocWiseFullLogo size={66} variant="dark" />
        </div>

        <button
          className="flex h-8 items-center gap-1.5 rounded-md border border-line bg-paper px-2.5 text-xs font-medium text-ink hover:bg-paper/80 transition-colors"
          type="button"
          onClick={reset}
          title="Upload another PDF"
        >
          <Upload className="h-3.5 w-3.5 text-ink/50" aria-hidden />
          <span className="max-w-[140px] truncate">{document?.fileName || "Upload PDF"}</span>
        </button>

        {/* Mode Segment Switcher */}
        <div className="flex rounded-md border border-line bg-paper p-0.5">
          <button
            className={`flex h-7 items-center gap-1.5 rounded px-2.5 text-xs font-semibold transition-all ${
              mode === "view" ? "bg-white text-accent shadow-xs" : "text-ink/60 hover:text-ink"
            }`}
            type="button"
            onClick={() => setMode("view")}
            title="View mode"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden />
            <span>View</span>
          </button>
          <button
            className={`flex h-7 items-center gap-1.5 rounded px-2.5 text-xs font-semibold transition-all ${
              mode === "document-edit" ? "bg-white text-accent shadow-xs" : "text-ink/60 hover:text-ink"
            }`}
            type="button"
            onClick={() => setMode("document-edit")}
            title="Edit document"
          >
            <Edit3 className="h-3.5 w-3.5" aria-hidden />
            <span>Edit</span>
          </button>
        </div>

        {/* History Controls */}
        <div className="flex items-center gap-1 border-l border-line pl-2">
          <button
            className="flex h-7 w-7 items-center justify-center rounded text-ink/60 hover:bg-paper hover:text-ink disabled:opacity-30 transition-colors"
            type="button"
            onClick={undo}
            disabled={undoStack.length === 0}
            title="Undo"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            className="flex h-7 w-7 items-center justify-center rounded text-ink/60 hover:bg-paper hover:text-ink disabled:opacity-30 transition-colors"
            type="button"
            onClick={redo}
            disabled={redoStack.length === 0}
            title="Redo"
          >
            <RotateCw className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            className="flex h-7 w-7 items-center justify-center rounded text-ink/60 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 transition-colors"
            type="button"
            onClick={deleteSelectedElement}
            disabled={!selectedElementId || mode !== "document-edit"}
            title="Delete selected text"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>

      {/* Right Zoom & Download Dropdown */}
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-md border border-line bg-paper px-1 py-0.5">
          <button
            className="flex h-6 w-6 items-center justify-center rounded text-ink/60 hover:bg-white hover:shadow-xs transition-all"
            type="button"
            onClick={() => setZoom(zoom - 0.1)}
            title="Zoom out"
          >
            <Minus className="h-3.5 w-3.5" aria-hidden />
          </button>
          <span className="w-12 text-center text-xs font-semibold tabular-nums text-ink">{Math.round(zoom * 100)}%</span>
          <button
            className="flex h-6 w-6 items-center justify-center rounded text-ink/60 hover:bg-white hover:shadow-xs transition-all"
            type="button"
            onClick={() => setZoom(zoom + 0.1)}
            title="Zoom in"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>

        {/* Unified Download Dropdown */}
        <div className="relative">
          <button
            className="flex h-8 items-center gap-2 rounded-lg bg-accent px-3.5 text-xs font-bold text-white hover:bg-accent-light disabled:opacity-70 shadow-xs shadow-accent/30 transition-all"
            type="button"
            onClick={() => setIsDownloadOpen((prev) => !prev)}
            disabled={exportMutation.isPending || exportDocxMutation.isPending}
            title="Download document options"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            <span>Download</span>
            <ChevronDown className="h-3.5 w-3.5 opacity-80" aria-hidden />
          </button>

          {isDownloadOpen && (
            <div className="absolute right-0 mt-1.5 z-50 w-52 rounded-xl border border-line bg-white p-1.5 shadow-xl ring-1 ring-black/5">
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-semibold text-ink hover:bg-paper hover:text-accent transition-colors"
                onClick={() => {
                  setIsDownloadOpen(false);
                  exportMutation.mutate();
                }}
              >
                <FileType className="h-4 w-4 text-signal" />
                <div>
                  <div className="font-bold">PDF Document</div>
                  <div className="text-[10px] font-normal text-ink/50">100% visual layout parity</div>
                </div>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-semibold text-ink hover:bg-paper hover:text-accent transition-colors"
                onClick={() => {
                  setIsDownloadOpen(false);
                  exportDocxMutation.mutate();
                }}
              >
                <FileText className="h-4 w-4 text-accent" />
                <div>
                  <div className="font-bold">Word Document</div>
                  <div className="text-[10px] font-normal text-ink/50">Editable .docx format</div>
                </div>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-semibold text-ink hover:bg-paper hover:text-accent transition-colors"
                onClick={handleDownloadTxt}
              >
                <FileText className="h-4 w-4 text-ink/40" />
                <div>
                  <div className="font-bold">Plain Text</div>
                  <div className="text-[10px] font-normal text-ink/50">Raw text file (.txt)</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
