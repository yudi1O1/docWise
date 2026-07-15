import { useEffect, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

import { PdfPageView } from "./PdfPageView";
import { useDocumentSession } from "../document-session/store";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export function PdfWorkspace() {
  const file = useDocumentSession((state) => state.originalFile);
  const document = useDocumentSession((state) => state.document);
  const [pdfDocument, setPdfDocument] = useState<pdfjs.PDFDocumentProxy | null>(null);

  useEffect(() => {
    if (!file) {
      return;
    }
    let cancelled = false;
    let loadingTask: pdfjs.PDFDocumentLoadingTask | null = null;

    file
      .arrayBuffer()
      .then((buffer) => {
        if (cancelled) {
          return;
        }
        loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
        return loadingTask.promise;
      })
      .then((loadedDocument) => {
        if (!cancelled && loadedDocument) {
          setPdfDocument(loadedDocument);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPdfDocument(null);
        }
      });

    return () => {
      cancelled = true;
      void loadingTask?.destroy();
    };
  }, [file]);

  if (!document) {
    return null;
  }

  return (
    <section className="min-h-0 overflow-auto bg-[#ebe7dd] p-6">
      <div className="mx-auto flex w-max flex-col gap-6">
        {document.pages.map((page) => (
          <PdfPageView key={page.pageNumber} page={page} pdfDocument={pdfDocument} />
        ))}
      </div>
    </section>
  );
}
