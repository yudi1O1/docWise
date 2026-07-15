# Architecture

docWise is a stateless document workspace.

```text
Browser memory
  -> original uploaded PDF bytes
  -> PDF.js base canvas
  -> transparent interaction metadata
  -> visible modification previews only
  -> export original PDF + current model
FastAPI request memory
  -> apply supported edits to original PDF
  -> stream generated PDF
Browser download
```

The server does not create permanent document records or reusable document IDs.

## Frontend

- `src/features/upload`: upload control and client validation.
- `src/features/document-session`: in-memory Zustand store.
- `src/features/editor`: toolbar, page list, PDF renderer, overlay editor.
- `src/features/export`: download workflow.
- `src/lib/coordinates.ts`: coordinate conversion helpers.
- `src/services/api.ts`: stateless API calls.

Each PDF page has one stable page container:

- Base PDF layer: original PDF.js canvas, visible in View and Edit mode.
- Interaction layer: transparent hit regions for extracted source text.
- Modification layer behavior: a local source-region mask plus one visible editor or preview for selected or changed source text.

Unmodified extracted text is never rendered as visible HTML over the original PDF.
V1 text positions are fixed; dragging, movement, and resizing are not exposed.

## Backend

- `app/api`: FastAPI routers.
- `app/models`: Pydantic API/document models.
- `app/services`: PDF validation, parsing, and export.
- `app/core`: settings and CORS configuration.

All processing state is request-scoped.

Export compares current elements with source metadata. Unchanged source text is left untouched in the PDF; changed or cleared source text is redacted at its original rectangle and redrawn from the current model when replacement text is present.
