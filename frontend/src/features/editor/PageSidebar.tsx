import { useDocumentSession } from "../document-session/store";

export function PageSidebar() {
  const document = useDocumentSession((state) => state.document);

  if (!document) {
    return null;
  }

  return (
    <aside className="min-h-0 overflow-auto border-r border-line bg-white p-3">
      <div className="space-y-2">
        {document.pages.map((page) => (
          <a
            key={page.pageNumber}
            href={`#page-${page.pageNumber}`}
            className="block border border-line bg-paper p-3 text-center text-sm font-medium hover:border-accent"
          >
            Page {page.pageNumber}
          </a>
        ))}
      </div>
    </aside>
  );
}
