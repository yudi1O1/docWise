import { useMutation } from "@tanstack/react-query";

import { useDocumentSession } from "../document-session/store";
import { exportDocx } from "../../services/api";

export function useExportDocx() {
  const originalFile = useDocumentSession((state) => state.originalFile);
  const document = useDocumentSession((state) => state.document);

  return useMutation({
    mutationFn: async () => {
      if (!originalFile) {
        throw new Error("No active document.");
      }
      return exportDocx(originalFile);
    },
    onSuccess: (blob) => {
      if (!document) {
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = `${document.fileName.replace(/\.pdf$/i, "") || "document"}.docx`;
      anchor.click();
      URL.revokeObjectURL(url);
    },
  });
}
