import type {
  ColumnNode,
  ColumnsNode,
  DocumentElement,
  DocumentModel,
  DocumentNode,
  DocumentStyle,
  InlineContent,
  InlineText,
  ListItemNode,
  ListNode,
  SourceBounds,
  StructuredDocument,
  TextElement,
} from "../../types/document";

interface NormalizedTextItem {
  id: string;
  text: string;
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  color: string;
  alignment: "left" | "center" | "right";
}

interface TextLine {
  id: string;
  pageNumber: number;
  text: string;
  items: NormalizedTextItem[];
  bounds: SourceBounds;
  style: DocumentStyle;
  marks: InlineText["marks"];
}

interface LayoutRegion {
  id: string;
  pageNumber: number;
  bounds: SourceBounds;
  items: NormalizedTextItem[];
}

interface TypographyProfile {
  bodyFontSize: number;
  headingThreshold: number;
  titleThreshold: number;
}

const BASELINE_TOLERANCE = 3.5;
const COLUMN_GAP = 72;
const SAME_WORD_GAP_RATIO = 0.28;
const LARGE_GAP_RATIO = 5.5;
const PARAGRAPH_GAP_RATIO = 1.35;
const INDENT_TOLERANCE = 14;
const FONT_TOLERANCE = 1.5;
const REGION_OVERLAP_RATIO = 0.18;

export function reconstructStructuredDocument(document: DocumentModel): StructuredDocument {
  const items = normalizeDocumentElements(document);
  const profile = typographyProfile(items);
  const nodes = document.pages.flatMap((page) => reconstructPage(page.pageNumber, items, profile));

  return {
    id: `structured-${stableHash(document.fileName)}`,
    sourcePdfId: document.fileName,
    fileName: document.fileName,
    pages: document.pages.map((page) => ({
      pageNumber: page.pageNumber,
      width: page.width,
      height: page.height,
    })),
    content: nodes,
  };
}

export function groupItemsIntoLines(items: NormalizedTextItem[]): TextLine[] {
  const lines: TextLine[] = [];
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const buckets: NormalizedTextItem[][] = [];

  for (const item of sorted) {
    const line = buckets.find((candidate) => belongsToLine(candidate, item));
    if (line) {
      line.push(item);
    } else {
      buckets.push([item]);
    }
  }

  for (const lineItems of buckets) {
    lines.push(makeLine(lineItems));
  }

  return lines.sort((a, b) => a.pageNumber - b.pageNumber || a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x);
}

export function groupLinesIntoNodes(lines: TextLine[], profile: TypographyProfile = typographyProfileFromLines(lines)): DocumentNode[] {
  const nodes: DocumentNode[] = [];
  let paragraph: TextLine[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return;
    }
    nodes.push(makeNodeFromLines(paragraph, profile));
    paragraph = [];
  };

  for (const line of lines) {
    if (isListLine(line)) {
      flushParagraph();
      appendListNode(nodes, line);
      continue;
    }

    const previous = paragraph[paragraph.length - 1];
    if (previous && !continuesParagraph(previous, line)) {
      flushParagraph();
    }
    paragraph.push(line);
  }
  flushParagraph();

  return nodes;
}

function reconstructPage(pageNumber: number, allItems: NormalizedTextItem[], profile: TypographyProfile): DocumentNode[] {
  const pageItems = allItems.filter((item) => item.pageNumber === pageNumber);
  if (pageItems.length === 0) {
    return [];
  }

  const regions = detectLayoutRegions(pageItems);
  if (regions.length <= 1) {
    return groupLinesIntoNodes(groupItemsIntoLines(pageItems), profile);
  }

  const regionNodes = regions.map((region) => ({
    region,
    nodes: groupLinesIntoNodes(groupItemsIntoLines(region.items), profile),
  }));

  if (!shouldRepresentAsColumns(regionNodes.map((entry) => entry.region))) {
    return regionNodes.flatMap((entry) => entry.nodes);
  }

  const bounds = boundsUnionAll(regions.map((region) => region.bounds));
  const columns: ColumnNode[] = regionNodes.map(({ region, nodes }, index) => ({
    id: `column-${stableHash(`${pageNumber}:${index}:${region.bounds.x}:${region.bounds.y}`)}`,
    content: nodes,
    sourcePage: pageNumber,
    sourceBounds: region.bounds,
    style: { indentation: region.bounds.x },
  }));
  const columnNode: ColumnsNode = {
    id: `columns-${stableHash(`${pageNumber}:${bounds.x}:${bounds.y}:${regions.length}`)}`,
    type: "columns",
    columns,
    sourcePage: pageNumber,
    sourceBounds: bounds,
    style: { marginBottom: 12 },
  };
  return [columnNode];
}

function normalizeDocumentElements(document: DocumentModel): NormalizedTextItem[] {
  const pageByNumber = new Map(document.pages.map((page) => [page.pageNumber, page]));

  return document.pages
    .flatMap((page) => page.elements)
    .filter((element): element is TextElement => element.type === "text" && element.content.trim().length > 0)
    .flatMap((element) => {
      const page = pageByNumber.get(element.source.pageNumber);
      const originalX = element.source.originalX ?? element.x;
      const originalY = element.source.originalY ?? element.y;
      const originalWidth = element.source.originalWidth ?? element.width;
      const originalHeight = element.source.originalHeight ?? element.height;
      const textLines = element.content.split(/\r?\n/).filter((line) => line.trim().length > 0);
      const lineHeight = textLines.length > 0 ? originalHeight / textLines.length : originalHeight;

      return textLines.map((text, index) => ({
        id: `${element.id}:line-${index}`,
        text: text.trim(),
        pageNumber: element.source.pageNumber,
        pageWidth: page?.width ?? 612,
        pageHeight: page?.height ?? 792,
        x: originalX,
        y: originalY + lineHeight * index,
        width: originalWidth,
        height: Math.max(lineHeight, element.fontSize * 1.15),
        fontSize: element.fontSize,
        fontFamily: element.fontFamily,
        fontWeight: element.fontWeight,
        fontStyle: element.fontStyle ?? inferFontStyle(element.fontFamily),
        color: element.color,
        alignment: element.alignment,
      }));
    });
}

function detectLayoutRegions(items: NormalizedTextItem[]): LayoutRegion[] {
  const sorted = [...items].sort((a, b) => a.x - b.x || a.y - b.y);
  const regions: Array<{ left: number; right: number; top: number; bottom: number; items: NormalizedTextItem[] }> = [];

  for (const item of sorted) {
    const itemRight = item.x + item.width;
    const itemBottom = item.y + item.height;
    const region = regions.find((candidate) => {
      const horizontalOverlap = Math.min(candidate.right, itemRight) - Math.max(candidate.left, item.x);
      const overlaps = horizontalOverlap > Math.min(item.width, candidate.right - candidate.left) * REGION_OVERLAP_RATIO;
      const nearby = Math.abs(item.x - candidate.left) <= COLUMN_GAP || Math.abs(itemRight - candidate.right) <= COLUMN_GAP;
      return overlaps || nearby;
    });
    if (region) {
      region.left = Math.min(region.left, item.x);
      region.right = Math.max(region.right, itemRight);
      region.top = Math.min(region.top, item.y);
      region.bottom = Math.max(region.bottom, itemBottom);
      region.items.push(item);
    } else {
      regions.push({ left: item.x, right: itemRight, top: item.y, bottom: itemBottom, items: [item] });
    }
  }

  return regions
    .map((region, index) => ({
      id: `region-${index}`,
      pageNumber: region.items[0].pageNumber,
      bounds: { x: region.left, y: region.top, width: region.right - region.left, height: region.bottom - region.top },
      items: region.items,
    }))
    .sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y);
}

function shouldRepresentAsColumns(regions: LayoutRegion[]): boolean {
  if (regions.length < 2 || regions.length > 3) {
    return false;
  }
  const sorted = [...regions].sort((a, b) => a.bounds.x - b.bounds.x);
  const verticalOverlap = Math.min(...sorted.map((region) => region.bounds.y + region.bounds.height)) - Math.max(...sorted.map((region) => region.bounds.y));
  const maxHeight = Math.max(...sorted.map((region) => region.bounds.height));
  const separated = sorted.every((region, index) => {
    if (index === 0) {
      return true;
    }
    const previous = sorted[index - 1];
    return region.bounds.x - (previous.bounds.x + previous.bounds.width) >= COLUMN_GAP;
  });
  return separated && verticalOverlap > maxHeight * 0.2;
}

function belongsToLine(line: NormalizedTextItem[], item: NormalizedTextItem): boolean {
  const averageY = line.reduce((sum, fragment) => sum + fragment.y, 0) / line.length;
  if (Math.abs(item.y - averageY) > Math.max(BASELINE_TOLERANCE, item.fontSize * 0.35, item.height * 0.3)) {
    return false;
  }

  const sorted = [...line].sort((a, b) => a.x - b.x);
  const nearest = sorted.reduce((closest, fragment) => {
    const distance = Math.min(Math.abs(item.x - (fragment.x + fragment.width)), Math.abs(fragment.x - (item.x + item.width)));
    return distance < closest.distance ? { distance, fragment } : closest;
  }, { distance: Number.POSITIVE_INFINITY, fragment: sorted[0] });
  const gapLimit = Math.max(COLUMN_GAP, Math.min(item.fontSize, nearest.fragment.fontSize) * LARGE_GAP_RATIO);
  return nearest.distance <= gapLimit;
}

function makeLine(items: NormalizedTextItem[]): TextLine {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  const bounds = boundsFor(sorted);
  const text = reconstructLineText(sorted);
  const dominant = dominantItem(sorted);
  const marks = marksFor(dominant);

  return {
    id: `line-${stableHash(`${dominant.pageNumber}:${bounds.x}:${bounds.y}:${text}`)}`,
    pageNumber: dominant.pageNumber,
    text,
    items: sorted,
    bounds,
    marks,
    style: {
      fontFamily: dominant.fontFamily,
      fontSize: dominant.fontSize,
      fontWeight: dominant.fontWeight,
      alignment: detectAlignment(bounds, dominant),
      lineHeight: 1.25,
      marginBottom: Math.max(4, dominant.fontSize * 0.4),
      indentation: bounds.x,
    },
  };
}

function reconstructLineText(items: NormalizedTextItem[]): string {
  return items.reduce((text, item, index) => {
    if (index === 0) {
      return item.text;
    }
    const previous = items[index - 1];
    const gap = item.x - (previous.x + previous.width);
    const shouldInsertSpace =
      gap > Math.max(2, Math.min(previous.fontSize, item.fontSize) * SAME_WORD_GAP_RATIO) &&
      !text.endsWith(" ") &&
      !item.text.startsWith(" ") &&
      !/^[,.;:!?)]/.test(item.text);
    return `${text}${shouldInsertSpace ? " " : ""}${item.text}`;
  }, "");
}

function continuesParagraph(previous: TextLine, current: TextLine): boolean {
  if (previous.pageNumber !== current.pageNumber) {
    return false;
  }
  if (isListLine(previous) || isListLine(current)) {
    return false;
  }
  if (isLikelyStandaloneHeading(previous) || isLikelyStandaloneHeading(current)) {
    return false;
  }
  if (Math.abs((previous.style.fontSize ?? 12) - (current.style.fontSize ?? 12)) > FONT_TOLERANCE) {
    return false;
  }
  if (previous.style.fontWeight !== current.style.fontWeight) {
    return false;
  }
  if (JSON.stringify(previous.marks ?? []) !== JSON.stringify(current.marks ?? [])) {
    return false;
  }

  const leftDelta = Math.abs(previous.bounds.x - current.bounds.x);
  const hangingIndent = current.bounds.x > previous.bounds.x && current.bounds.x - previous.bounds.x <= Math.max(36, (current.style.fontSize ?? 12) * 3);
  if (leftDelta > INDENT_TOLERANCE && !hangingIndent) {
    return false;
  }

  const gap = current.bounds.y - (previous.bounds.y + previous.bounds.height);
  const lineHeight = Math.max(previous.bounds.height, current.bounds.height, current.style.fontSize ?? 12);
  return gap <= lineHeight * PARAGRAPH_GAP_RATIO;
}

function makeNodeFromLines(lines: TextLine[], profile: TypographyProfile): DocumentNode {
  const text = lines.map((line) => line.text).join(" ");
  const bounds = boundsForLines(lines);
  const first = lines[0];
  const content = inlineText(text, first.marks);
  const style = { ...first.style, marginBottom: paragraphMargin(lines) };

  if (isHeading(lines, profile)) {
    return {
      id: `heading-${stableHash(`${first.pageNumber}:${bounds.x}:${bounds.y}:${text}`)}`,
      type: "heading",
      level: headingLevel(first.style.fontSize ?? profile.bodyFontSize, profile),
      content,
      style: { ...style, fontWeight: "bold" },
      sourcePage: first.pageNumber,
      sourceBounds: bounds,
      sourceText: text,
    };
  }

  return {
    id: `paragraph-${stableHash(`${first.pageNumber}:${bounds.x}:${bounds.y}:${text}`)}`,
    type: "paragraph",
    content,
    style,
    sourcePage: first.pageNumber,
    sourceBounds: bounds,
    sourceText: text,
  };
}

function appendListNode(nodes: DocumentNode[], line: TextLine): void {
  const parsed = parseListLine(line.text);
  if (!parsed) {
    return;
  }

  const type = parsed.kind === "bullet" ? "bulletList" : "orderedList";
  const item: ListItemNode = {
    id: `list-item-${stableHash(`${line.pageNumber}:${line.bounds.x}:${line.bounds.y}:${parsed.text}`)}`,
    content: inlineText(parsed.text, line.marks),
    sourcePage: line.pageNumber,
    sourceBounds: line.bounds,
    sourceText: line.text,
    style: { ...line.style, indentation: parsed.contentX ?? line.bounds.x },
  };
  const previous = nodes[nodes.length - 1];
  if (previous?.type === type && Math.abs((previous.sourceBounds?.x ?? line.bounds.x) - line.bounds.x) <= Math.max(INDENT_TOLERANCE, 18)) {
    previous.items.push(item);
    previous.sourceBounds = boundsUnion(previous.sourceBounds ?? line.bounds, line.bounds);
    return;
  }

  const node: ListNode = {
    id: `${type}-${stableHash(`${line.pageNumber}:${line.bounds.x}:${line.bounds.y}`)}`,
    type,
    items: [item],
    style: line.style,
    sourcePage: line.pageNumber,
    sourceBounds: line.bounds,
  };
  nodes.push(node);
}

function isListLine(line: TextLine): boolean {
  return parseListLine(line.text) !== null;
}

function parseListLine(text: string): { kind: "bullet" | "ordered"; text: string; contentX?: number } | null {
  const bullet = text.match(/^([*+\-\u2022\u25cf\u25cb\u25aa\u2013])\s+(.+)$/);
  if (bullet) {
    return { kind: "bullet", text: bullet[2].trim() };
  }
  const ordered = text.match(/^((?:\d+|[a-zA-Z]|[ivxlcdmIVXLCDM]+)[.)])\s+(.+)$/);
  if (ordered) {
    return { kind: "ordered", text: ordered[2].trim() };
  }
  return null;
}

function isHeading(lines: TextLine[], profile: TypographyProfile): boolean {
  if (lines.length > 2) {
    return false;
  }
  const line = lines[0];
  const fontSize = line.style.fontSize ?? profile.bodyFontSize;
  const shortText = line.text.length < 120;
  return shortText && (fontSize >= profile.headingThreshold || line.style.fontWeight === "bold" || isAllCapsHeading(line.text));
}

function headingLevel(fontSize: number, profile: TypographyProfile): 1 | 2 | 3 | 4 | 5 | 6 {
  if (fontSize >= profile.titleThreshold) {
    return 1;
  }
  if (fontSize >= profile.headingThreshold * 1.15) {
    return 2;
  }
  if (fontSize >= profile.headingThreshold) {
    return 3;
  }
  return 4;
}

function typographyProfile(items: NormalizedTextItem[]): TypographyProfile {
  const sizes = items.map((item) => item.fontSize).filter((size) => Number.isFinite(size) && size > 0).sort((a, b) => a - b);
  const bodyFontSize = sizes.length > 0 ? sizes[Math.floor((sizes.length - 1) / 2)] : 12;
  return {
    bodyFontSize,
    headingThreshold: bodyFontSize * 1.18,
    titleThreshold: bodyFontSize * 1.65,
  };
}

function typographyProfileFromLines(lines: TextLine[]): TypographyProfile {
  return typographyProfile(lines.flatMap((line) => line.items));
}

function detectAlignment(bounds: SourceBounds, item: NormalizedTextItem): "left" | "center" | "right" {
  const pageCenter = item.pageWidth / 2;
  const lineCenter = bounds.x + bounds.width / 2;
  const rightMargin = item.pageWidth - (bounds.x + bounds.width);
  const leftMargin = bounds.x;
  if (Math.abs(lineCenter - pageCenter) <= Math.max(12, item.pageWidth * 0.03)) {
    return "center";
  }
  if (rightMargin < leftMargin * 0.45) {
    return "right";
  }
  return item.alignment;
}

function paragraphMargin(lines: TextLine[]): number {
  const first = lines[0];
  return Math.max(8, (first.style.fontSize ?? 12) * 0.65);
}

function isLikelyStandaloneHeading(line: TextLine): boolean {
  return line.text.length < 80 && (line.style.fontWeight === "bold" || isAllCapsHeading(line.text));
}

function isAllCapsHeading(text: string): boolean {
  const letters = text.replace(/[^a-zA-Z]/g, "");
  return letters.length >= 3 && letters === letters.toUpperCase();
}

function inferFontStyle(fontFamily: string): "normal" | "italic" {
  return /italic|oblique/i.test(fontFamily) ? "italic" : "normal";
}

function marksFor(item: NormalizedTextItem): InlineText["marks"] {
  const marks: NonNullable<InlineText["marks"]> = [];
  if (item.fontWeight === "bold" || /bold|black|heavy/i.test(item.fontFamily)) {
    marks.push("bold");
  }
  if (item.fontStyle === "italic" || inferFontStyle(item.fontFamily) === "italic") {
    marks.push("italic");
  }
  return marks.length > 0 ? marks : undefined;
}

function dominantItem(items: NormalizedTextItem[]): NormalizedTextItem {
  return [...items].sort((a, b) => b.text.length - a.text.length || b.fontSize - a.fontSize)[0];
}

function inlineText(text: string, marks?: InlineText["marks"]): InlineContent[] {
  return [{ type: "text", text, marks }];
}

function boundsFor(items: NormalizedTextItem[]): SourceBounds {
  const x = Math.min(...items.map((item) => item.x));
  const y = Math.min(...items.map((item) => item.y));
  const right = Math.max(...items.map((item) => item.x + item.width));
  const bottom = Math.max(...items.map((item) => item.y + item.height));
  return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
}

function boundsForLines(lines: TextLine[]): SourceBounds {
  return boundsUnionAll(lines.map((line) => line.bounds));
}

function boundsUnionAll(bounds: SourceBounds[]): SourceBounds {
  return bounds.slice(1).reduce(boundsUnion, bounds[0]);
}

function boundsUnion(a: SourceBounds, b: SourceBounds): SourceBounds {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return { x, y, width: right - x, height: bottom - y };
}

function stableHash(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}
