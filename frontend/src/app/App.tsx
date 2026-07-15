import { FileText } from "lucide-react";

import { EditorShell } from "../features/editor/EditorShell";
import { PdfUpload } from "../features/upload/PdfUpload";
import { useDocumentSession } from "../features/document-session/store";

export function App() {
  const document = useDocumentSession((state) => state.document);

  return (
    <main className="h-full bg-paper text-ink">
      {document ? (
        <EditorShell />
      ) : (
        <section className="grid h-full place-items-center px-6">
          <div className="w-full max-w-xl border border-line bg-white p-8 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <FileText className="h-9 w-9 text-accent" aria-hidden />
              <div>
                <h1 className="text-2xl font-semibold tracking-normal">docWise</h1>
                <p className="text-sm text-ink/70">Temporary PDF workspace</p>
              </div>
            </div>
            <PdfUpload />
          </div>
        </section>
      )}
    </main>
  );
}
