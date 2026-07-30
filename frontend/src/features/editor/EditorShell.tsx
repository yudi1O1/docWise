import { useDocumentSession } from "../document-session/store";
import { FormatRibbon } from "./FormatRibbon";
import { PageSidebar } from "./PageSidebar";
import { PdfWorkspace } from "./PdfWorkspace";
import { Toolbar } from "./Toolbar";

/**
 * EditorShell — three-row layout:
 *   Row 1 (56px): Main Toolbar — logo, mode switcher, undo/redo, download
 *   Row 2 (auto): FormatRibbon — text formatting bar, only visible in edit mode
 *   Row 3 (1fr): Page sidebar + Document workspace
 */
export function EditorShell() {
  const mode = useDocumentSession((state) => state.mode);
  const isEditMode = mode === "document-edit" || mode === "quick-edit";

  return (
    <div className={`grid h-full ${isEditMode ? "grid-rows-[56px_auto_1fr]" : "grid-rows-[56px_1fr]"}`}>
      <Toolbar />
      {isEditMode && <FormatRibbon />}
      <div className="grid min-h-0 grid-cols-[340px_minmax(0,1fr)] border-t border-line">
        <PageSidebar />
        <PdfWorkspace />
      </div>
    </div>
  );
}
