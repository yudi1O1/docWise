import { FileCheck2, Sparkles, Wand2, Zap } from "lucide-react";

import { EditorShell } from "../features/editor/EditorShell";
import { PdfUpload } from "../features/upload/PdfUpload";
import { useDocumentSession } from "../features/document-session/store";
import { DocWiseFullLogo, DocWiseLogo } from "../features/editor/DocWiseLogo";

export function App() {
  const document = useDocumentSession((state) => state.document);

  return (
    <main className="h-full font-sans selection:bg-accent selection:text-white">
      {document ? (
        <EditorShell />
      ) : (
        <div className="relative flex h-screen w-full flex-col justify-between overflow-hidden bg-[#edf1f0] p-0 m-0">
          {/* Subtle background ambient tint */}
          <div className="pointer-events-none absolute -top-32 left-1/2 -z-0 h-[480px] w-[780px] -translate-x-1/2 rounded-full bg-accent/10 blur-[130px]" />
          <div className="pointer-events-none absolute bottom-0 left-0 -z-0 h-[300px] w-[500px] rounded-full bg-accent/5 blur-[100px]" />

          {/* ── Top Brand Header ── */}
          <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-6 pt-2 pb-0 shrink-0">
            {/* Logo block */}
            <DocWiseFullLogo size={174} variant="dark" />

            {/* Live status pill */}
            <div className="flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-1 text-[11px] font-semibold text-ink/70 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              SuperDocs AI Engine · Live
            </div>
          </header>

          {/* ── Middle Hero Section (Spread content evenly across full height, 0 empty gaps top/bottom) ── */}
          <section className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-between px-6 py-2 text-center min-h-0">
            {/* Top Group: Owl Agent Hero Badge, Headline, Sub-headline */}
            <div className="flex flex-col items-center mt-1">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent/25 bg-white px-4 py-1 text-xs font-semibold text-accent-dark shadow-2xs">
                <DocWiseLogo size={18} />
                <span>DocWise AI Agent · Natural Language PDF Reconstruction</span>
              </div>

              {/* Headline on ONE LINE */}
              <h1 className="mb-2.5 max-w-4xl text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-ink whitespace-nowrap leading-tight">
                Edit any PDF with{" "}
                <span
                  className="relative inline-block"
                  style={{
                    background: "linear-gradient(135deg, #2d8e97 0%, #0c3f4e 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  natural language
                </span>
              </h1>

              {/* Sub-headline */}
              <p className="max-w-xl text-xs sm:text-sm leading-relaxed text-ink/65">
                Upload any PDF — resume, report, contract. Talk to your document, ask for
                instant rewrites, formatting fixes, or summaries. Export with 100% visual parity.
              </p>
            </div>

            {/* Middle Group: Upload Card */}
            <div className="my-auto w-full max-w-md py-1">
              <div className="rounded-2xl border border-line bg-white p-5 shadow-lg">
                <div className="mb-3 flex items-center justify-center gap-2">
                  <DocWiseLogo size={18} />
                  <p className="text-xs font-bold uppercase tracking-widest text-ink/70">
                    Drop your PDF to begin
                  </p>
                </div>
                <PdfUpload />
                <p className="mt-2.5 text-[10px] text-ink/45">Supports PDF up to 50 MB · Powered by SuperDocs AI</p>
              </div>
            </div>

            {/* Bottom Group: Feature Cards */}
            <div className="mb-1 grid w-full max-w-3xl grid-cols-1 gap-3.5 sm:grid-cols-3">
              {[
                {
                  icon: <DocWiseLogo size={22} />,
                  title: "DocWise Owl Agent",
                  desc: "Chat & edit documents in natural language",
                },
                {
                  icon: <FileCheck2 className="h-4 w-4 text-accent" />,
                  title: "Layout Parity",
                  desc: "100% accurate PDF exports",
                },
                {
                  icon: <Zap className="h-4 w-4 text-accent" />,
                  title: "Multi-Format Export",
                  desc: "PDF, Word (DOCX) & Text",
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className="group rounded-xl border border-line bg-white p-3.5 shadow-2xs transition-all hover:border-accent/40 hover:shadow-md text-left"
                >
                  <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                    {f.icon}
                  </div>
                  <h3 className="mb-0.5 text-xs font-bold text-ink">{f.title}</h3>
                  <p className="text-[10px] text-ink/55 leading-snug">{f.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Footer */}
          <footer className="relative z-10 mx-auto w-full max-w-5xl px-6 pb-2 pt-0 text-center text-[10px] text-ink/40 font-medium shrink-0">
            docWise AI Studio &copy; 2026 · Empowered by SuperDocs REST API
          </footer>
        </div>
      )}
    </main>
  );
}
