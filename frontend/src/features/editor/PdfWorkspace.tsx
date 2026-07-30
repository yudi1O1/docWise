import { ReconstructedPage } from "./ReconstructedPage";
import { useDocumentSession } from "../document-session/store";

/**
 * PdfWorkspace — renders the document as a reconstructed HTML document.
 *
 * Each page is a white div at exact PDF dimensions, and each text element is
 * an absolutely-positioned contentEditable div with exact font, size, weight,
 * style, color, and position from the PDF extraction.
 *
 * The FloatingFormatToolbar appears above any selected text in edit mode.
 */
export function PdfWorkspace() {
  const document = useDocumentSession((state) => state.document);

  if (!document) {
    return null;
  }

  return (
    <section
      className="min-h-0 overflow-auto"
      style={{ background: "#d6d3cc" }}
      aria-label="Document workspace"
    >
      <div className="mx-auto flex w-max flex-col items-center gap-8 px-8 py-8">
        {document.pages.map((page) => (
          <ReconstructedPage key={page.pageNumber} page={page} />
        ))}
      </div>
    </section>
  );
}
