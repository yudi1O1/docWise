import { MouseEvent, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

import { pageToCssLength, pageToCssRect } from "../../lib/coordinates";
import type { DocumentElement, PageModel } from "../../types/document";
import { useDocumentSession } from "../document-session/store";
import { TextOverlayElement } from "./TextOverlayElement";

interface PdfPageViewProps {
  page: PageModel;
  pdfDocument: PDFDocumentProxy | null;
}

export function PdfPageView({ page, pdfDocument }: PdfPageViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pdfPage, setPdfPage] = useState<PDFPageProxy | null>(null);
  const [rendered, setRendered] = useState(false);
  const zoom = useDocumentSession((state) => state.zoom);
  const document = useDocumentSession((state) => state.document);
  const selectElement = useDocumentSession((state) => state.selectElement);

  useEffect(() => {
    if (!pdfDocument) {
      return;
    }
    if (page.pageNumber > pdfDocument.numPages) {
      setPdfPage(null);
      setRendered(true);
      return;
    }
    pdfDocument.getPage(page.pageNumber).then(setPdfPage);
  }, [page.pageNumber, pdfDocument]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pdfPage) {
      return;
    }
    setRendered(false);
    const viewport = pdfPage.getViewport({ scale: zoom });
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    const outputScale = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;
    const renderTask = pdfPage.render({ canvasContext: context, viewport, transform });
    renderTask.promise
      .then(() => setRendered(true))
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "RenderingCancelledException") {
          return;
        }
        setRendered(false);
      });
    return () => {
      renderTask.cancel();
    };
  }, [pdfPage, zoom]);

  const clearSelection = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      selectElement(null);
    }
  };
  const displacedSourceMasks =
    document?.pages
      .flatMap((documentPage) =>
        documentPage.elements
          .filter((element) => shouldMaskDisplacedSource(element, page.pageNumber, documentPage.pageNumber))
          .map((element) => {
            const rect = pageToCssRect(
              {
                x: element.source.originalX ?? element.x,
                y: element.source.originalY ?? element.y,
                width: element.source.originalWidth ?? element.width,
                height: element.source.originalHeight ?? element.height,
              },
              zoom,
            );
            return { id: element.id, rect };
          }),
      ) ?? [];

  return (
    <article
      id={`page-${page.pageNumber}`}
      className="relative overflow-hidden bg-white shadow-sm"
      style={{ width: pageToCssLength(page.width, zoom), height: pageToCssLength(page.height, zoom) }}
      onMouseDown={clearSelection}
      data-testid={`pdf-page-${page.pageNumber}`}
    >
      <div className="absolute inset-0" data-testid="base-pdf-layer">
        {page.pageNumber <= (pdfDocument?.numPages ?? page.pageNumber) && (
          <canvas
            ref={canvasRef}
            className="absolute inset-0"
            data-testid="base-pdf-canvas"
            data-rendered={rendered ? "true" : "false"}
          />
        )}
      </div>
      <div className="absolute inset-0" data-testid="interaction-layer">
        {displacedSourceMasks.map(({ id, rect }) => (
          <div
            key={`displaced-mask-${id}`}
            className="absolute bg-white"
            style={{
              left: rect.x,
              top: rect.y,
              width: Math.max(rect.width, 1),
              height: Math.max(rect.height, 1),
            }}
            aria-hidden
            data-testid="displaced-source-mask"
          />
        ))}
        {page.elements.map((element) => (
          <TextOverlayElement key={element.id} element={element} pageNumber={page.pageNumber} />
        ))}
      </div>
    </article>
  );
}

function shouldMaskDisplacedSource(element: DocumentElement, visiblePageNumber: number, elementPageNumber: number) {
  if (element.source.isNew || element.source.pageNumber !== visiblePageNumber || elementPageNumber === visiblePageNumber) {
    return false;
  }

  return (
    element.content !== (element.source.originalText ?? element.content) ||
    element.x !== (element.source.originalX ?? element.x) ||
    element.y !== (element.source.originalY ?? element.y) ||
    element.width !== (element.source.originalWidth ?? element.width) ||
    element.height !== (element.source.originalHeight ?? element.height)
  );
}
