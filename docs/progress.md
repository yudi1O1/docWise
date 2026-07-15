# Progress

## Acceptance Criteria

- [x] Repository inspected.
- [x] Stateless architecture selected.
- [x] Documentation started.
- [x] React + TypeScript frontend scaffolded.
- [x] FastAPI backend scaffolded.
- [x] PDF parse endpoint implemented.
- [x] PDF viewer implemented.
- [x] Edit mode implemented for text overlays.
- [x] Fixed-position existing text editing.
- [x] Undo and redo.
- [x] PDF export endpoint implemented.
- [x] Verification and hardening baseline.
- [x] Milestone A rendering architecture fixed.
- [x] Strengthened PDF validation.
- [x] Browser rendering flow manually verified.
- [x] Milestone B simplified existing text editing.
- [ ] DOCX support.
- [ ] Conversion support.

## Current Milestone

This continuation resumed the existing workspace after the previous implementation session stopped at the final verification stage. Phase 1 through Phase 5 are implemented as a first V1 path. Milestone A is complete, and Milestone B is deliberately simplified for V1: fixed-position existing text editing only.

## Architecture Decisions

- The browser owns the active editing session.
- The backend is stateless and request-scoped.
- No database, object storage, document history, or saved projects are used.
- The internal document model is shared conceptually between frontend and backend.
- PyMuPDF coordinates are treated as page-space coordinates with the origin at the top-left.
- PDF export leaves unchanged source text untouched.
- PDF export redacts original source boxes only for modified or cleared source text and draws replacement text where needed.
- Dragging, movement, and resizing are intentionally not part of the V1 editor.

## Root Cause Notes

- View Mode PDF invisibility: the frontend loaded PDF.js from a Blob URL. In React Strict Mode, effect cleanup revoked the Blob URL during the development double-effect cycle, and PDF.js later failed with `ERR_FILE_NOT_FOUND`. The fix loads PDF.js from an in-memory `ArrayBuffer`/`Uint8Array`.
- Edit Mode visual changes: unmodified extracted text was rendered as visible HTML textareas over the original PDF. The fix separates transparent interaction hit regions from visible modification previews.
- Export over-reconstruction: export previously redacted and redrew all extracted source text. It now compares current elements with original source metadata and touches only changed or cleared source text.
- Ghost/shadow text while editing: selected text used a semi-transparent `textarea` over the original PDF canvas, so source glyphs showed through behind replacement text. The fix renders a solid local mask over the original source bounding box and then renders exactly one active editor or exactly one modified preview above it.
- V1 movement removal: pointer-drag handlers, move cursors, movement coordinate helpers, and the `moveElement` Zustand action were removed from the current editor path. Dragging over text no longer mutates `x` or `y`.

## Rendering Architecture

- `BasePdfLayer`: PDF.js canvas, always mounted and visible.
- `InteractionLayer`: transparent hit regions for extracted source text, active only in Edit mode.
- `ModificationLayer`: local source-region masks plus one visible active editor or one visible modified preview for changed source text.
- Canvas backing dimensions and CSS dimensions are tracked separately; overlays use CSS/logical viewport dimensions.

## Verification Log

- `frontend`: `npm test` passed with 5 tests.
- `frontend`: `npm run build` passed.
- `frontend`: `npm run lint` passed.
- `backend`: `py -m pytest` passed with 5 tests.
- Updated frontend tests: 13 tests covering validation, coordinates, editor state, transparent hit regions, active editing masks, shorter replacement masking, modified previews, and no text movement.
- Updated backend tests: 14 tests covering valid parse/export, invalid signatures, empty files, wrong extension/content type, corrupted PDFs, password-protected PDFs, oversized PDFs, malformed export payloads, deletion, updated text export, and unchanged content preservation.
- Manual browser verification with local Chrome and generated PDFs:
  - PDF visible immediately in View Mode.
  - View/Edit toggle preserves base canvas bitmap and page dimensions.
  - Unmodified source text produces transparent hit regions and no visible duplicate previews.
  - Active editing shows one local source mask and one editor.
  - Shorter replacement text (`Software Developer` to `Dev`) masks the full original source box without ghost text.
  - Finished edits show one modified preview and no active editor.
  - Dragging over edited text does not move it.
  - Export removes original replaced text, writes replacement text, and leaves unrelated text untouched.
  - Undo, redo, export, refresh reset, multi-page rendering, zoom alignment, and invalid renamed PDF handling verified.
- Build warning: the PDF.js worker/app bundle is larger than Vite's default chunk warning threshold.
- Dependency note: `npm audit` reports transitive advisories in the frontend dependency tree; no force upgrade was applied.
- Dependency note: `playwright-core` remains as an intentional dev dependency for local Chrome-based manual verification.

## Known Limitations

- V1 text export uses built-in PDF fonts and may not exactly match source fonts.
- Redaction can cover backgrounds or overlapping content inside the original text bounding box.
- Modified text previews use a simple white-backed overlay and are not perfect for textured, image, gradient, or transparent backgrounds.
- Replacement text does not reflow surrounding PDF content and may extend beyond the original source box.
- Existing text cannot be dragged, moved, or resized in V1.
- Complex scripts, rotated text, embedded custom fonts, and scanned documents are not fully supported.
- The browser session is intentionally lost on refresh.
