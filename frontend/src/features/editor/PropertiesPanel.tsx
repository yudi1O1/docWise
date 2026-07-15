import { useMemo } from "react";

import { useDocumentSession } from "../document-session/store";

export function PropertiesPanel() {
  const mode = useDocumentSession((state) => state.mode);
  const document = useDocumentSession((state) => state.document);
  const structuredDocument = useDocumentSession((state) => state.structuredDocument);
  const selectedElementId = useDocumentSession((state) => state.selectedElementId);
  const selected = useMemo(
    () => document?.pages.flatMap((page) => page.elements).find((element) => element.id === selectedElementId) ?? null,
    [document, selectedElementId],
  );

  return (
    <aside className="min-h-0 overflow-auto border-l border-line bg-white p-4">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-normal text-ink/60">
        {mode === "document-edit" ? "Document" : "Selection"}
      </h2>
      {mode === "document-edit" ? (
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-ink/60">Mode</dt>
            <dd className="font-medium">Document Edit</dd>
          </div>
          <div>
            <dt className="text-ink/60">Blocks</dt>
            <dd className="font-medium">{structuredDocument?.content.length ?? 0}</dd>
          </div>
        </dl>
      ) : selected ? (
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-ink/60">Font size</dt>
            <dd className="font-medium">{Math.round(selected.fontSize)} px</dd>
          </div>
          <div>
            <dt className="text-ink/60">Position</dt>
            <dd className="font-medium">
              {Math.round(selected.x)}, {Math.round(selected.y)}
            </dd>
          </div>
          <div>
            <dt className="text-ink/60">Dimensions</dt>
            <dd className="font-medium">
              {Math.round(selected.width)} x {Math.round(selected.height)}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-ink/60">No text selected</p>
      )}
    </aside>
  );
}
