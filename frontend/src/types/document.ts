export type SourceType = "pdf";
export type EditorMode = "view" | "quick-edit" | "document-edit";

export interface ElementSource {
  pageNumber: number;
  originalText?: string;
  originalX?: number;
  originalY?: number;
  originalWidth?: number;
  originalHeight?: number;
  isNew: boolean;
}

export interface TextElement {
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
  fontStyle?: "normal" | "italic";
  color: string;
  alignment: "left" | "center" | "right";
  rotation: number;
  source: ElementSource;
}

export type DocumentElement = TextElement;

export interface PageModel {
  pageNumber: number;
  width: number;
  height: number;
  elements: DocumentElement[];
}

export interface DocumentModel {
  sourceType: SourceType;
  fileName: string;
  pageCount: number;
  pages: PageModel[];
}

export interface SourcePageMetadata {
  pageNumber: number;
  width: number;
  height: number;
}

export interface SourceBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BaseDocumentNode {
  id: string;
  sourcePage?: number;
  sourceBounds?: SourceBounds;
  sourceText?: string;
}

export interface InlineText {
  type: "text";
  text: string;
  marks?: Array<"bold" | "italic" | "underline" | "strike">;
}

export type InlineContent = InlineText;

export interface DocumentStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string | number;
  alignment?: "left" | "center" | "right" | "justify";
  lineHeight?: number;
  marginTop?: number;
  marginBottom?: number;
  indentation?: number;
}

export interface ParagraphNode extends BaseDocumentNode {
  type: "paragraph";
  content: InlineContent[];
  style: DocumentStyle;
}

export interface HeadingNode extends BaseDocumentNode {
  type: "heading";
  level: 1 | 2 | 3 | 4 | 5 | 6;
  content: InlineContent[];
  style: DocumentStyle;
}

export interface ListItemNode extends BaseDocumentNode {
  id: string;
  content: InlineContent[];
  style?: DocumentStyle;
}

export interface ListNode extends BaseDocumentNode {
  type: "bulletList" | "orderedList";
  items: ListItemNode[];
  style?: DocumentStyle;
}

export interface ColumnNode extends BaseDocumentNode {
  id: string;
  content: DocumentNode[];
  style?: DocumentStyle;
}

export interface ColumnsNode extends BaseDocumentNode {
  type: "columns";
  columns: ColumnNode[];
  style?: DocumentStyle;
}

export interface FixedLayoutNode extends BaseDocumentNode {
  type: "fixedLayout";
  content: InlineContent[];
  style?: DocumentStyle;
}

export type DocumentNode = ParagraphNode | HeadingNode | ListNode | ColumnsNode | FixedLayoutNode;

export interface StructuredDocument {
  id: string;
  sourcePdfId?: string;
  fileName: string;
  pages: SourcePageMetadata[];
  content: DocumentNode[];
}
