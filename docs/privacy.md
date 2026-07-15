# Privacy

docWise does not intentionally permanently store uploaded or generated documents.

- Uploaded documents exist in browser memory and request-scoped backend memory.
- Editing state exists only in the current browser page session.
- Refreshing or closing the page clears the active workspace.
- PDF.js loads the active PDF from in-memory bytes rather than a persistent browser store.
- The backend does not use a database, document history, saved projects, or object storage.
- Server processing is request-scoped.
- Temporary files may be used internally only when a processing library requires them.
- Temporary resources must be cleaned immediately after processing.

The application cannot control operating system paging, browser internals, network infrastructure, or user device backups. Privacy claims are limited to application behavior.
