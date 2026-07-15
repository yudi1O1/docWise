import type {
  ColumnNode,
  DocumentModel,
  DocumentNode,
  InlineContent,
  ListItemNode,
  PageModel,
  SourceBounds,
  SourcePageMetadata,
  StructuredDocument,
  TextElement,
} from "../../types/document";

const DEFAULT_MARGIN = 48;
const DEFAULT_FONT_SIZE = 12;
const DEFAULT_LINE_HEIGHT = 1.35;
const MIN_TEXTBOX_HEIGHT = 8;

interface PlacementCursor {
  pageIndex: number;
  y: number;
}

interface TextPlacement {
  id: string;
  text: string;
  style: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string | number;
    color?: string;
    alignment?: "left" | "center" | "right" | "justify";
    lineHeight?: number;
    indentation?: number;
  };
  sourcePage?: number;
  sourceBounds?: SourceBounds;
  sourceText?: string;
  listMarker?: string;
}

interface FlowPlacement {
  pageIndex: number;
  element: TextElement;
}

export function structuredDocumentToExportModel(structuredDocument: StructuredDocument, fallbackDocument: DocumentModel): DocumentModel {
  const sourcePages = structuredDocument.pages.length > 0 ? structuredDocument.pages : fallbackDocument.pages;
  const pages = sourcePages.map((page) => ({
    pageNumber: page.pageNumber,
    width: page.width,
    height: page.height,
    elements: [] as TextElement[],
  }));
  const cursor: PlacementCursor = { pageIndex: 0, y: DEFAULT_MARGIN };

  for (const placement of structuredDocument.content.flatMap(nodeToPlacements)) {
    for (const flowPlacement of placementToTextElements(placement, pages, cursor)) {
      pages[flowPlacement.pageIndex]?.elements.push(flowPlacement.element);
    }
  }

  return {
    ...fallbackDocument,
    pageCount: pages.length,
    pages,
  };
}

function nodeToPlacements(node: DocumentNode): TextPlacement[] {
  switch (node.type) {
    case "bulletList":
    case "orderedList":
      return node.items.map((item, index) => ({
        id: item.id,
        text: inlineText(item.content),
        style: { ...node.style, ...item.style },
        sourcePage: item.sourcePage ?? node.sourcePage,
        sourceBounds: item.sourceBounds,
        sourceText: item.sourceText,
        listMarker: node.type === "bulletList" ? "*" : `${index + 1}.`,
      }));
    case "columns":
      return node.columns.flatMap((column, index) => columnToPlacements(column, `${node.id}-${index}`));
    case "heading":
    case "paragraph":
    case "fixedLayout":
      return [
        {
          id: node.id,
          text: inlineText(node.content),
          style: node.style ?? {},
          sourcePage: node.sourcePage,
          sourceBounds: node.sourceBounds,
          sourceText: node.sourceText,
        },
      ];
  }
}

function columnToPlacements(column: ColumnNode, prefix: string): TextPlacement[] {
  return column.content.flatMap((node) =>
    nodeToPlacements(node).map((placement) => ({
      ...placement,
      id: `${prefix}-${placement.id}`,
      style: { ...placement.style, indentation: column.style?.indentation ?? placement.style.indentation },
    })),
  );
}

function placementToTextElements(placement: TextPlacement, pages: PageModel[], cursor: PlacementCursor): FlowPlacement[] {
  const page = pageForPlacement(pages, cursor);
  const fontSize = placement.style.fontSize ?? DEFAULT_FONT_SIZE;
  const lineHeight = placement.style.lineHeight ?? DEFAULT_LINE_HEIGHT;
  const sourceBounds = placement.sourceBounds;
  const x = DEFAULT_MARGIN + (placement.style.indentation ? Math.min(24, Math.max(0, placement.style.indentation - DEFAULT_MARGIN)) : 0);
  const width = Math.max(120, page.width - x - DEFAULT_MARGIN);
  const chunks = splitTextForPages(placement.listMarker ? `${placement.listMarker} ${placement.text}` : placement.text, width, fontSize, lineHeight, pages, cursor);

  return chunks.map((chunk, index) => {
    const activePage = pages[chunk.pageIndex];
    const targetPageNumber = activePage.pageNumber;
    const sourcePage = placement.sourcePage ?? targetPageNumber;
    return {
      pageIndex: chunk.pageIndex,
      element: {
        id: `doc-edit-${placement.id}-${index}`,
        type: "text",
        content: chunk.text,
        x,
        y: chunk.y,
        width,
        height: chunk.height,
        fontSize,
        fontFamily: placement.style.fontFamily ?? "helv",
        fontWeight: normalizeWeight(placement.style.fontWeight),
        color: placement.style.color ?? "#000000",
        alignment: normalizeAlignment(placement.style.alignment),
        rotation: 0,
        source: {
          pageNumber: sourcePage,
          originalText: index === 0 ? placement.sourceText ?? placement.text : chunk.text,
          originalX: index === 0 ? sourceBounds?.x ?? x : x,
          originalY: index === 0 ? sourceBounds?.y ?? chunk.y : chunk.y,
          originalWidth: index === 0 ? sourceBounds?.width ?? width : width,
          originalHeight: index === 0 ? sourceBounds?.height ?? chunk.height : chunk.height,
          isNew: !sourceBounds || index > 0,
        },
      },
    };
  });
}

function pageForPlacement(pages: PageModel[], cursor: PlacementCursor): SourcePageMetadata {
  if (!pages[cursor.pageIndex]) {
    pages.push(clonePage(pages[pages.length - 1], pages.length + 1));
  }
  return pages[Math.min(cursor.pageIndex, pages.length - 1)];
}

function nextCursorY(cursor: PlacementCursor, pages: PageModel[], height: number): number {
  let page = pageForPlacement(pages, cursor);
  const bottom = page.height - DEFAULT_MARGIN;
  if (cursor.y + height <= bottom) {
    return cursor.y;
  }
  cursor.pageIndex += 1;
  page = pageForPlacement(pages, cursor);
  return DEFAULT_MARGIN;
}

function splitTextForPages(
  text: string,
  width: number,
  fontSize: number,
  lineHeight: number,
  pages: PageModel[],
  cursor: PlacementCursor,
): Array<{ text: string; pageIndex: number; y: number; height: number }> {
  const lines = wrapText(text, width, fontSize);
  const chunks: Array<{ text: string; pageIndex: number; y: number; height: number }> = [];
  let remaining = lines;

  while (remaining.length > 0) {
    const page = pageForPlacement(pages, cursor);
    const lineHeightPx = fontSize * lineHeight;
    const availableHeight = Math.max(MIN_TEXTBOX_HEIGHT, page.height - DEFAULT_MARGIN - cursor.y);
    const maxLines = Math.max(1, Math.floor(availableHeight / lineHeightPx));
    const linesForPage = remaining.slice(0, maxLines);
    const height = Math.max(lineHeightPx, linesForPage.length * lineHeightPx);
    const y = nextCursorY(cursor, pages, height);
    const pageIndex = cursor.pageIndex;
    chunks.push({ text: linesForPage.join("\n"), pageIndex, y, height });
    cursor.y = y + height + Math.max(8, fontSize * 0.65);
    remaining = remaining.slice(linesForPage.length);
    if (remaining.length > 0 && cursor.y >= pages[cursor.pageIndex].height - DEFAULT_MARGIN) {
      cursor.pageIndex += 1;
      pageForPlacement(pages, cursor);
      cursor.y = DEFAULT_MARGIN;
    }
  }

  return chunks;
}

function wrapText(text: string, width: number, fontSize: number): string[] {
  const averageCharWidth = fontSize * 0.52;
  const maxCharsPerLine = Math.max(1, Math.floor(width / averageCharWidth));
  const lines: string[] = [];

  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxCharsPerLine && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    lines.push(current || "");
  }

  return lines;
}

function clonePage(page: SourcePageMetadata, pageNumber: number): PageModel {
  return {
    pageNumber,
    width: page.width,
    height: page.height,
    elements: [],
  };
}

function estimateTextHeight(text: string, width: number, fontSize: number, lineHeight: number): number {
  const averageCharWidth = fontSize * 0.52;
  const maxCharsPerLine = Math.max(1, Math.floor(width / averageCharWidth));
  const visualLines = text
    .split(/\r?\n/)
    .reduce((count, line) => count + Math.max(1, Math.ceil(line.length / maxCharsPerLine)), 0);
  return Math.max(fontSize * lineHeight, visualLines * fontSize * lineHeight);
}

function inlineText(content: InlineContent[]): string {
  return content.map((part) => part.text).join("");
}

function normalizeWeight(weight: string | number | undefined): "normal" | "bold" {
  return weight === "bold" || Number(weight) >= 600 ? "bold" : "normal";
}

function normalizeAlignment(alignment: string | undefined): "left" | "center" | "right" {
  return alignment === "center" || alignment === "right" ? alignment : "left";
}
