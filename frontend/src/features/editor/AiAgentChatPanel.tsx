import React, { useEffect, useRef, useState } from "react";
import { Check, Loader2, Send, Sparkles, User } from "lucide-react";

import { useDocumentSession } from "../document-session/store";
import { sendSuperDocsAiEdit } from "../../services/api";
import { DocWiseLogo } from "./DocWiseLogo";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  proposedHtml?: string;
  isApplied?: boolean;
  timestamp: string;
}

function extractCleanText(html: string): string {
  if (!html) return "";
  const temp = window.document.createElement("div");
  temp.innerHTML = html;
  return (temp.textContent || temp.innerText || "").trim();
}

/** Converts a markdown-ish string from SuperDocs into formatted JSX */
function renderMarkdown(text: string): React.ReactNode {
  if (!text) return null;

  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let key = 0;

  const inlineFormat = (line: string): React.ReactNode => {
    // Handle **bold**, *italic*, `code`
    const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-bold text-ink">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return <em key={i} className="italic">{part.slice(1, -1)}</em>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={i} className="rounded bg-slate-100 px-1 py-0.5 text-[10px] font-mono text-indigo-700">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines (add spacing)
    if (line.trim() === "") {
      nodes.push(<div key={key++} className="h-1.5" />);
      i++;
      continue;
    }

    // Heading: ## or ###
    if (/^#{1,3}\s/.test(line)) {
      const level = (line.match(/^#+/) ?? [""])[0].length;
      const content = line.replace(/^#+\s/, "");
      const cls = level === 1
        ? "text-sm font-bold text-ink mt-1 mb-0.5"
        : level === 2
        ? "text-xs font-bold text-ink mt-1 mb-0.5 uppercase tracking-wide"
        : "text-xs font-semibold text-ink mt-0.5";
      nodes.push(<p key={key++} className={cls}>{inlineFormat(content)}</p>);
      i++;
      continue;
    }

    // Unordered list: - or * or •
    if (/^[-*•]\s/.test(line.trim())) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && /^[-*•]\s/.test(lines[i].trim())) {
        const content = lines[i].trim().replace(/^[-*•]\s/, "");
        listItems.push(
          <li key={i} className="flex gap-1.5 leading-relaxed">
            <span className="mt-0.5 shrink-0 text-indigo-500">•</span>
            <span>{inlineFormat(content)}</span>
          </li>
        );
        i++;
      }
      nodes.push(<ul key={key++} className="my-1 space-y-0.5 text-[11px]">{listItems}</ul>);
      continue;
    }

    // Numbered list: 1. 2. etc.
    if (/^\d+\.\s/.test(line.trim())) {
      const listItems: React.ReactNode[] = [];
      let num = 1;
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        const content = lines[i].trim().replace(/^\d+\.\s/, "");
        listItems.push(
          <li key={i} className="flex gap-1.5 leading-relaxed">
            <span className="shrink-0 font-semibold text-indigo-500">{num}.</span>
            <span>{inlineFormat(content)}</span>
          </li>
        );
        i++;
        num++;
      }
      nodes.push(<ol key={key++} className="my-1 space-y-0.5 text-[11px]">{listItems}</ol>);
      continue;
    }

    // Regular paragraph
    nodes.push(<p key={key++} className="leading-relaxed">{inlineFormat(line)}</p>);
    i++;
  }

  return <div className="space-y-0.5 text-[11px]">{nodes}</div>;
}

export function AiAgentChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-1",
      role: "assistant",
      content: "Hello! I am your AI Document Agent. Chat with me to request revisions or edits. I will propose changes here so you can review and apply them to your document.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const document = useDocumentSession((state) => state.document);
  const structuredDocument = useDocumentSession((state) => state.structuredDocument);
  const editorInstance = useDocumentSession((state) => state.editorInstance);
  const setMode = useDocumentSession((state) => state.setMode);
  const triggerAiHighlight = useDocumentSession((state) => state.triggerAiHighlight);

  const sessionIdRef = useRef<string>(
    structuredDocument?.id || (document?.fileName ? `docwise-${document.fileName}` : `docwise-session-${Date.now()}`)
  );

  useEffect(() => {
    if (structuredDocument?.id) {
      sessionIdRef.current = structuredDocument.id;
    } else if (document?.fileName) {
      sessionIdRef.current = `docwise-${document.fileName}`;
    }
  }, [document?.fileName, structuredDocument?.id]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleApplyChanges = (messageId: string, proposedHtml?: string) => {
    if (!proposedHtml || !editorInstance) return;

    setMode("document-edit");
    editorInstance.commands.setContent(proposedHtml);
    triggerAiHighlight();

    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, isApplied: true } : msg)),
    );
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const promptText = inputPrompt.trim();
    if (!promptText || loading) {
      return;
    }

    const userMessageId = `user-${Date.now()}`;
    const userTimestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsg: ChatMessage = {
      id: userMessageId,
      role: "user",
      content: promptText,
      timestamp: userTimestamp,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt("");
    setLoading(true);
    setError(null);

    setMode("document-edit");

    try {
      const sessionId = sessionIdRef.current;
      const currentHtml = editorInstance ? editorInstance.getHTML() : "<p>Sample Document</p>";

      const res = await sendSuperDocsAiEdit({
        session_id: sessionId,
        message: promptText,
        document_html: currentHtml,
      });

      const updatedHtml = res.document_html;
      const isContentChanged = updatedHtml && updatedHtml !== currentHtml;
      const autoApply = /apply|implement|confirm|do it|yes/i.test(promptText);
      const isSummaryPrompt = /summarize|summary|overview|explain|what is|tell me/i.test(promptText);

      if (autoApply && isContentChanged && editorInstance) {
        editorInstance.commands.setContent(updatedHtml);
        triggerAiHighlight();
      }

      let responseContent = res.message;
      if (!responseContent || responseContent.trim() === "") {
        const textContent = extractCleanText(updatedHtml);
        if (isSummaryPrompt && textContent) {
          responseContent = `Document Overview & Summary:\n\n${textContent}`;
        } else if (isContentChanged) {
          responseContent = `I've prepared the requested edits for "${promptText}". Review below and click 'Apply to Document' to update your document page.`;
        } else {
          responseContent = textContent || "I have analyzed your document.";
        }
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: responseContent,
        proposedHtml: isContentChanged ? updatedHtml : undefined,
        isApplied: Boolean(autoApply && isContentChanged),
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "AI edit request failed.";
      setError(errMsg);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `⚠️ Error: ${errMsg}. Please try again.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-paper text-ink" data-testid="ai-agent-chat-panel">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-line px-4 py-3 bg-white shadow-xs">
        <DocWiseLogo size={34} />
        <div>
          <h2 className="text-sm font-bold text-ink tracking-tight flex items-center gap-1.5">
            DocWise AI Agent
          </h2>
          <p className="text-xs text-ink/50">Natural language document editing</p>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-paper">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="shrink-0 pt-0.5">
                <DocWiseLogo size={30} />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed shadow-xs ${
                msg.role === "user"
                  ? "bg-accent text-white rounded-br-none"
                  : "bg-white text-ink border border-line rounded-bl-none"
              }`}
            >
              {msg.role === "user" ? (
                <p className="whitespace-pre-wrap text-[11px] leading-relaxed">{msg.content}</p>
              ) : (
                renderMarkdown(msg.content)
              )}

              {/* Proposed HTML Apply Action */}
              {msg.role === "assistant" && msg.proposedHtml && (
                <div className="mt-2.5 pt-2 border-t border-line/60">
                  {msg.isApplied ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      Applied to document
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleApplyChanges(msg.id, msg.proposedHtml)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white hover:bg-accent-light shadow-xs transition-all"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Apply to Document
                    </button>
                  )}
                </div>
              )}

              <span className={`block mt-1.5 text-[10px] ${msg.role === "user" ? "text-white/60 text-right" : "text-ink/40"}`}>
                {msg.timestamp}
              </span>
            </div>
            {msg.role === "user" && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-paper text-ink text-xs border border-line">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2.5 items-center text-xs text-accent bg-paper border border-line p-2.5 rounded-lg animate-pulse">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            <span>AI is preparing document edits...</span>
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* Quick Suggestion Chips */}
      <div className="flex overflow-x-auto gap-1.5 px-3 py-2 border-t border-line bg-white scrollbar-none">
        {["Summarize document", "Fix typos", "Make headers bold", "Executive tone"].map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={loading}
            onClick={() => {
              setInputPrompt(prompt);
            }}
            className="shrink-0 rounded-full border border-line bg-paper px-2.5 py-1 text-[11px] font-medium text-ink/70 hover:border-accent hover:bg-paper hover:text-accent transition-colors shadow-xs disabled:opacity-40"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSendMessage} className="border-t border-line bg-white p-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            disabled={loading}
            placeholder="Ask AI to edit document..."
            className="flex-1 rounded-md border border-line bg-paper px-3 py-2 text-xs text-ink placeholder-ink/40 outline-none focus:border-accent focus:bg-white focus:ring-1 focus:ring-accent/30 disabled:opacity-50 transition-all"
          />
          <button
            type="submit"
            disabled={loading || !inputPrompt.trim()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50 transition-colors shadow-xs"
            title="Send message to AI agent"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        {error && <p className="mt-1.5 text-[11px] font-medium text-signal">{error}</p>}
      </form>
    </div>
  );
}
