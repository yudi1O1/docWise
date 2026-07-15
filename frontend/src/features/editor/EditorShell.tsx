import { DocumentEditor } from "../document-edit/DocumentEditor";
import { useDocumentSession } from "../document-session/store";
import { PageSidebar } from "./PageSidebar";
import { PdfWorkspace } from "./PdfWorkspace";
import { PropertiesPanel } from "./PropertiesPanel";
import { Toolbar } from "./Toolbar";

export function EditorShell() {
  const mode = useDocumentSession((state) => state.mode);

  return (
    <div className="grid h-full grid-rows-[56px_1fr]">
      <Toolbar />
      <div className="grid min-h-0 grid-cols-[180px_minmax(0,1fr)_260px] border-t border-line">
        <PageSidebar />
        {mode === "document-edit" ? <DocumentEditor /> : <PdfWorkspace />}
        <PropertiesPanel />
      </div>
    </div>
  );
}
