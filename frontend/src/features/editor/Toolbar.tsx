import { Download, Edit3, Eye, Minus, Plus, RotateCcw, RotateCw, Trash2, Upload } from "lucide-react";

import { useExportPdf } from "../export/useExportPdf";
import { useDocumentSession } from "../document-session/store";

export function Toolbar() {
  const mode = useDocumentSession((state) => state.mode);
  const zoom = useDocumentSession((state) => state.zoom);
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

  return (
    <header className="flex min-w-0 items-center justify-between gap-3 bg-white px-3">
      <div className="flex items-center gap-2">
        <button className="toolbar-button" type="button" onClick={reset} title="Upload another PDF">
          <Upload className="h-4 w-4" aria-hidden />
        </button>
        <div className="flex overflow-hidden border border-line">
          <button
            className={`toolbar-segment ${mode === "view" ? "bg-ink text-white" : "bg-white"}`}
            type="button"
            onClick={() => setMode("view")}
            title="View mode"
          >
            <Eye className="h-4 w-4" aria-hidden />
          </button>
          <button
            className={`toolbar-segment ${mode === "document-edit" ? "bg-ink text-white" : "bg-white"}`}
            type="button"
            onClick={() => setMode("document-edit")}
            title="Edit document"
          >
            <Edit3 className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <button className="toolbar-button" type="button" onClick={undo} disabled={undoStack.length === 0} title="Undo">
          <RotateCcw className="h-4 w-4" aria-hidden />
        </button>
        <button className="toolbar-button" type="button" onClick={redo} disabled={redoStack.length === 0} title="Redo">
          <RotateCw className="h-4 w-4" aria-hidden />
        </button>
        <button
          className="toolbar-button"
          type="button"
          onClick={deleteSelectedElement}
          disabled={!selectedElementId || mode !== "quick-edit"}
          title="Delete selected text"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button className="toolbar-button" type="button" onClick={() => setZoom(zoom - 0.1)} title="Zoom out">
          <Minus className="h-4 w-4" aria-hidden />
        </button>
        <span className="w-14 text-center text-sm tabular-nums">{Math.round(zoom * 100)}%</span>
        <button className="toolbar-button" type="button" onClick={() => setZoom(zoom + 0.1)} title="Zoom in">
          <Plus className="h-4 w-4" aria-hidden />
        </button>
        <button
          className="flex h-9 items-center gap-2 border border-accent bg-accent px-3 text-sm font-medium text-white hover:bg-accent/90 disabled:cursor-wait disabled:opacity-70"
          type="button"
          onClick={() => exportMutation.mutate()}
          disabled={exportMutation.isPending}
          title="Download PDF"
        >
          <Download className="h-4 w-4" aria-hidden />
          PDF
        </button>
      </div>
    </header>
  );
}
