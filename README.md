# docWise

docWise is a browser-based, privacy-focused document workspace for temporary PDF editing.

Documents are not intentionally stored by the application. The active document exists in the current browser session, is processed request-by-request by FastAPI, and is discarded when the page is refreshed or closed unless the user downloads the result.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, TanStack Query, Zustand, PDF.js
- Backend: Python, FastAPI, PyMuPDF, Pydantic

## Run Locally

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend expects the API at `http://localhost:8000` by default. Override with `VITE_API_BASE_URL`.

## Capabilities

- Upload a PDF for temporary processing.
- Extract pages and editable text blocks.
- Render pages in the browser.
- Render the original PDF.js canvas as the visual source of truth in View and Edit mode.
- Use transparent interaction regions for unmodified source text.
- Edit existing supported text in place with undo and redo in browser memory.
- Export an edited PDF as a direct download.

## Privacy Model

- No uploaded or generated documents are intentionally persisted.
- The server does not keep document registries, document IDs, history, or saved projects.
- Processing is request-scoped.
- Browser state is in memory only; refresh or close the tab to discard it.
- Temporary operating-system files may be used later if required by a library, but must be cleaned immediately.

## Known Limitations

- PDF editing is layout-based, not flowing text editing.
- Export applies supported modifications to the original uploaded PDF, not to a previously exported PDF.
- Modified or cleared source text is redacted at its original bounding box and replacement text is drawn where needed.
- V1 does not support dragging, repositioning, resizing, document reflow, DOCX, OCR, images, shapes, or annotations.
- Live edit previews use a local solid mask over the source text region, which is best suited to plain backgrounds.
- Font matching is approximate in V1.
- Scanned PDFs and OCR are not yet supported.
