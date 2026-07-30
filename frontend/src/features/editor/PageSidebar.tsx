import { useMemo, useState } from "react";
import { BarChart3, Layers, Sparkles } from "lucide-react";

import { useDocumentSession } from "../document-session/store";
import { AiAgentChatPanel } from "./AiAgentChatPanel";

export function PageSidebar() {
  const [activeTab, setActiveTab] = useState<"ai" | "pages" | "insights">("ai");
  const document = useDocumentSession((state) => state.document);
  const structuredDocument = useDocumentSession((state) => state.structuredDocument);

  const stats = useMemo(() => {
    if (!document) return { words: 0, chars: 0, paragraphs: 0, readingTime: "< 1 min" };
    let text = "";
    if (structuredDocument) {
      text = structuredDocument.content
        .map((n) => ("content" in n && Array.isArray(n.content) ? n.content.map((c) => ("text" in c ? c.text : "")).join("") : ""))
        .join(" ");
    } else {
      text = document.pages.flatMap((p) => p.elements.map((e) => e.content)).join(" ");
    }
    const words = text.split(/\s+/).filter(Boolean).length;
    const chars = text.length;
    const paragraphs = text.split(/\n\s*\n/).filter(Boolean).length || 1;
    const minutes = Math.ceil(words / 200);
    return {
      words,
      chars,
      paragraphs,
      readingTime: `${minutes} min${minutes > 1 ? "s" : ""}`,
    };
  }, [document, structuredDocument]);

  if (!document) {
    return null;
  }

  return (
    <aside className="flex min-h-0 flex-col border-r border-line bg-paper text-ink" data-testid="left-sidebar">
      {/* Sidebar Tab Bar */}
      <div className="flex border-b border-line bg-white">
        <button
          type="button"
          onClick={() => setActiveTab("ai")}
          className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold tracking-wide transition-colors ${
            activeTab === "ai"
              ? "border-b-2 border-accent bg-paper text-accent"
              : "text-ink/50 hover:bg-paper hover:text-ink"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          AI Agent
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("pages")}
          className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold tracking-wide transition-colors ${
            activeTab === "pages"
              ? "border-b-2 border-accent bg-paper text-accent"
              : "text-ink/50 hover:bg-paper hover:text-ink"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          Pages ({document.pages.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("insights")}
          className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold tracking-wide transition-colors ${
            activeTab === "insights"
              ? "border-b-2 border-accent bg-paper text-accent"
              : "text-ink/50 hover:bg-paper hover:text-ink"
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          Insights
        </button>
      </div>

      {/* Tab Body */}
      <div className="flex-1 min-h-0 bg-paper">
        {activeTab === "ai" ? (
          <AiAgentChatPanel />
        ) : activeTab === "pages" ? (
          <div className="min-h-0 h-full overflow-auto p-3 space-y-2">
            {document.pages.map((page) => (
              <a
                key={page.pageNumber}
                href={`#page-${page.pageNumber}`}
                className="block border border-line bg-white p-3 text-center text-xs font-medium text-ink hover:border-accent hover:bg-paper transition-colors shadow-xs rounded-sm"
              >
                Page {page.pageNumber}
              </a>
            ))}
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink/60">Document Analytics</h3>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-lg border border-line bg-white p-3 shadow-xs">
                <span className="block text-xl font-extrabold text-accent">{stats.words}</span>
                <span className="text-[11px] font-medium text-ink/60">Total Words</span>
              </div>
              <div className="rounded-lg border border-line bg-white p-3 shadow-xs">
                <span className="block text-xl font-extrabold text-accent">{stats.chars}</span>
                <span className="text-[11px] font-medium text-ink/60">Characters</span>
              </div>
              <div className="rounded-lg border border-line bg-white p-3 shadow-xs">
                <span className="block text-xl font-extrabold text-accent">{document.pages.length}</span>
                <span className="text-[11px] font-medium text-ink/60">Pages</span>
              </div>
              <div className="rounded-lg border border-line bg-white p-3 shadow-xs">
                <span className="block text-xl font-extrabold text-accent">{stats.readingTime}</span>
                <span className="text-[11px] font-medium text-ink/60">Read Time</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
