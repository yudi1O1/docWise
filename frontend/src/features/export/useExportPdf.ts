import { useMutation } from "@tanstack/react-query";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

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

      const pageElements = Array.from(
        window.document.querySelectorAll<HTMLElement>('[data-testid^="document-edit-page"], [data-testid^="pdf-page-"]'),
      ).filter((el) => el.offsetWidth > 0 && el.offsetHeight > 0);

      if (pageElements.length > 0) {
        try {
          let pdf: jsPDF | null = null;

          for (let index = 0; index < pageElements.length; index += 1) {
            const pageEl = pageElements[index];
            const canvas = await html2canvas(pageEl, {
              scale: 2,
              useCORS: true,
              logging: false,
              backgroundColor: "#ffffff",
            });

            const widthPt = (pageEl.offsetWidth * 72) / 96;
            const heightPt = (pageEl.offsetHeight * 72) / 96;
            const orientation = widthPt > heightPt ? "landscape" : "portrait";

            if (!pdf) {
              pdf = new jsPDF({
                orientation,
                unit: "pt",
                format: [widthPt, heightPt],
              });
            } else {
              pdf.addPage([widthPt, heightPt], orientation);
            }

            const imgData = canvas.toDataURL("image/png");
            pdf.addImage(imgData, "PNG", 0, 0, widthPt, heightPt, undefined, "FAST");
          }

          if (pdf) {
            return pdf.output("blob");
          }
        } catch {
          // Fall back to API export if DOM capture fails
        }
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
