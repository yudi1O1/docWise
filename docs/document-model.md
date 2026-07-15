# Document Model

The document model is independent of PDF.js and PyMuPDF runtime objects.

```ts
DocumentModel {
  sourceType: "pdf";
  fileName: string;
  pageCount: number;
  pages: PageModel[];
}

PageModel {
  pageNumber: number;
  width: number;
  height: number;
  elements: DocumentElement[];
}

TextElement {
  id: string;
  type: "text";
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: "normal" | "bold";
  color: string;
  alignment: "left" | "center" | "right";
  rotation: number;
  source: {
    pageNumber: number;
    originalText?: string;
    originalX?: number;
    originalY?: number;
    originalWidth?: number;
    originalHeight?: number;
    isNew?: boolean;
  };
}
```

Coordinates use page space with the origin at the top-left. In V1, existing text coordinates remain fixed during editing.

The `source` fields preserve the original extracted PDF identity and bounding box. They are used for transparent hit regions and for export-time redaction of only the modified source element.
