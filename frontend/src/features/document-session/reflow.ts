import type { DocumentElement, PageModel } from "../../types/document";

const FLOW_OVERLAP_THRESHOLD = 0.6;
const MIN_FLOW_GAP = 2;
const LAYOUT_EPSILON = 0.75;
const FALLBACK_PAGE_PADDING = 24;
const MAX_INFERRED_MARGIN = 96;

function sourceX(element: DocumentElement): number {
  return element.source.originalX ?? element.x;
}

function sourceY(element: DocumentElement): number {
  return element.source.originalY ?? element.y;
}

function sourceWidth(element: DocumentElement): number {
  return element.source.originalWidth ?? element.width;
}

function sourceHeight(element: DocumentElement): number {
  return element.source.originalHeight ?? element.height;
}

function hasEffectiveModification(element: DocumentElement): boolean {
  return (
    element.source.isNew ||
    element.content !== (element.source.originalText ?? element.content)
  );
}

function effectiveHeight(element: DocumentElement): number {
  return hasEffectiveModification(element) ? element.height : sourceHeight(element);
}

function effectiveWidth(element: DocumentElement): number {
  return hasEffectiveModification(element) ? element.width : sourceWidth(element);
}

function horizontalOverlapRatio(a: DocumentElement, b: DocumentElement): number {
  const aStart = sourceX(a);
  const aEnd = aStart + sourceWidth(a);
  const bStart = sourceX(b);
  const bEnd = bStart + sourceWidth(b);
  const intersection = Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
  const denominator = Math.max(1, Math.min(sourceWidth(a), sourceWidth(b)));
  return intersection / denominator;
}

function sameFlow(a: DocumentElement, b: DocumentElement): boolean {
  return horizontalOverlapRatio(a, b) >= FLOW_OVERLAP_THRESHOLD;
}

function sourcePageNumber(element: DocumentElement): number {
  return element.source.pageNumber;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function usableBounds(page: PageModel, sourceElements: DocumentElement[]): { top: number; bottom: number } {
  if (sourceElements.length === 0) {
    return {
      top: FALLBACK_PAGE_PADDING,
      bottom: Math.max(FALLBACK_PAGE_PADDING, page.height - FALLBACK_PAGE_PADDING),
    };
  }

  const top = Math.max(0, Math.min(...sourceElements.map(sourceY)));
  const lowestSourceBottom = Math.max(...sourceElements.map((element) => sourceY(element) + sourceHeight(element)));
  const inferredBottomMargin = clamp(page.height - lowestSourceBottom, FALLBACK_PAGE_PADDING, MAX_INFERRED_MARGIN);
  return {
    top,
    bottom: Math.max(top + MIN_FLOW_GAP, page.height - inferredBottomMargin),
  };
}

function makeOverflowPage(previousPage: PageModel, pageNumber: number): PageModel {
  return {
    pageNumber,
    width: previousPage.width,
    height: previousPage.height,
    elements: [],
  };
}

function sourceOrder(a: DocumentElement, b: DocumentElement): number {
  return sourcePageNumber(a) - sourcePageNumber(b) || sourceY(a) - sourceY(b) || sourceX(a) - sourceX(b);
}

function originalGap(previous: DocumentElement, element: DocumentElement): number {
  if (sourcePageNumber(previous) !== sourcePageNumber(element)) {
    return MIN_FLOW_GAP;
  }

  return Math.max(sourceY(element) - (sourceY(previous) + sourceHeight(previous)), MIN_FLOW_GAP);
}

export function deriveReflowedPage(page: PageModel): PageModel {
  const sorted = [...page.elements].sort((a, b) => sourceY(a) - sourceY(b) || sourceX(a) - sourceX(b));
  const derived = new Map<string, DocumentElement>();

  for (const element of sorted) {
    const baseY = sourceY(element);
    let effectiveY = baseY;

    for (const previous of sorted) {
      if (previous.id === element.id || sourceY(previous) >= baseY) {
        continue;
      }
      if (!sameFlow(previous, element)) {
        continue;
      }

      const previousEffective = derived.get(previous.id) ?? previous;
      const previousChangedLayout =
        Math.abs(previousEffective.y - sourceY(previous)) >= LAYOUT_EPSILON ||
        (hasEffectiveModification(previousEffective) &&
          Math.abs(effectiveHeight(previousEffective) - sourceHeight(previous)) >= LAYOUT_EPSILON);
      if (!previousChangedLayout) {
        continue;
      }
      const originalGap = baseY - (sourceY(previous) + sourceHeight(previous));
      const requiredGap = Math.max(originalGap, MIN_FLOW_GAP);
      const candidateY = previousEffective.y + effectiveHeight(previousEffective) + requiredGap;
      effectiveY = Math.max(effectiveY, candidateY);
    }

    const snappedY = Math.abs(effectiveY - baseY) < LAYOUT_EPSILON ? baseY : effectiveY;

    derived.set(element.id, {
      ...element,
      x: sourceX(element),
      y: snappedY,
      width: effectiveWidth(element),
      height: effectiveHeight(element),
    });
  }

  return {
    ...page,
    elements: page.elements.map((element) => derived.get(element.id) ?? element),
  };
}

export function deriveReflowedPages(pages: PageModel[]): PageModel[] {
  if (pages.length === 0) {
    return [];
  }

  const allElements = pages.flatMap((page) => page.elements).sort(sourceOrder);
  const elementsBySourcePage = new Map<number, DocumentElement[]>();
  for (const element of allElements) {
    const pageNumber = sourcePageNumber(element);
    elementsBySourcePage.set(pageNumber, [...(elementsBySourcePage.get(pageNumber) ?? []), element]);
  }

  const pageTemplates = pages.map((page) => ({ ...page, elements: [] }));
  const sourcePages = new Set<number>([
    ...pageTemplates.map((page) => page.pageNumber),
    ...allElements.map(sourcePageNumber),
  ]);
  const lastSourcePage = Math.max(...sourcePages);
  const derivedPages: PageModel[] = [];
  let carry: DocumentElement[] = [];
  let pageIndex = 0;
  let guard = 0;
  const maxPages = Math.max(pages.length + allElements.length + 1, pages.length + 1);

  while ((pageIndex < lastSourcePage || carry.length > 0) && guard < maxPages) {
    guard += 1;
    const pageNumber = pageIndex + 1;
    const template =
      pageTemplates[pageIndex] ?? makeOverflowPage(pageTemplates[pageTemplates.length - 1] ?? pages[0], pageNumber);
    const sourceElements = elementsBySourcePage.get(pageNumber) ?? [];
    const bounds = usableBounds(template, sourceElements);
    const incomingCarry = carry;
    const elementsForPage = [...incomingCarry, ...sourceElements];
    const placed: DocumentElement[] = [];
    const nextCarry: DocumentElement[] = [];
    const overflowingFlowAnchors: DocumentElement[] = [];

    for (const element of elementsForPage) {
      const fromCarry = incomingCarry.some((carried) => carried.id === element.id);
      const baseY = fromCarry ? bounds.top : sourceY(element);
      let effectiveY = baseY;

      if (overflowingFlowAnchors.some((anchor) => sameFlow(anchor, element))) {
        nextCarry.push(element);
        overflowingFlowAnchors.push(element);
        continue;
      }

      for (const previous of placed) {
        if (!sameFlow(previous, element)) {
          continue;
        }

        const candidateY = previous.y + effectiveHeight(previous) + originalGap(previous, element);
        effectiveY = Math.max(effectiveY, candidateY);
      }

      const snappedY = Math.abs(effectiveY - baseY) < LAYOUT_EPSILON ? baseY : effectiveY;
      const reflowedElement = {
        ...element,
        x: sourceX(element),
        y: snappedY,
        width: effectiveWidth(element),
        height: effectiveHeight(element),
      };

      const crossesPageBottom = reflowedElement.y + reflowedElement.height > bounds.bottom + LAYOUT_EPSILON;
      const canMoveToNextPage = placed.length > 0 || fromCarry || sourceElements.length > 1;
      if (crossesPageBottom && canMoveToNextPage) {
        nextCarry.push(element);
        overflowingFlowAnchors.push(element);
        continue;
      }

      placed.push(reflowedElement);
    }

    derivedPages.push({ ...template, elements: placed });
    carry = nextCarry;
    pageIndex += 1;
  }

  return derivedPages.filter((page, index) => index < pages.length || page.elements.length > 0);
}
