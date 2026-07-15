import { useMutation } from "@tanstack/react-query";

import { useDocumentSession } from "../document-session/store";
import { exportPdf } from "../../services/api";
import { structuredDocumentToExportModel } from "../document-edit/exportModel";

export function useExportPdf() {
  const originalFile = useDocumentSession((state) => state.originalFile);
  const document = useDocumentSession((state) => state.document);
  const structuredDocument = useDocumentSession((state) => state.structuredDocument);
  const mode = useDocumentSession((state) => state.mode);

  return useMutation({
    mutationFn: async () => {
      if (!originalFile || !document) {
        throw new Error("No active document.");
      }
      const exportDocument =
        mode === "document-edit" && structuredDocument
          ? structuredDocumentToExportModel(structuredDocument, document)
          : document;
      return exportPdf(originalFile, exportDocument);
    },
    onSuccess: (blob) => {
      if (!document) {
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = `${document.fileName.replace(/\.pdf$/i, "") || "document"}-edited.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    },
  });
}
