# API

## `GET /api/health`

Returns service status.

## `POST /api/pdf/parse`

Multipart form:

- `file`: PDF file

Returns a normalized document model with pages and text elements.

Validation:

- file extension must be `.pdf`
- content type must be PDF or octet-stream
- file signature must start with `%PDF-`
- file size must be within the configured limit
- encrypted PDFs are rejected
- corrupted or unreadable PDFs are rejected
- PDFs over the configured page count are rejected

## `POST /api/pdf/export`

Multipart form:

- `file`: original PDF file
- `document`: JSON serialized normalized document model

Returns:

- `application/pdf` streamed as an attachment

The endpoint applies supported text changes to the original uploaded PDF. Unchanged source text is left untouched. Changed or cleared source text is redacted at the original source rectangle; replacement text is drawn from the current model when present.
