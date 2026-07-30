import { useMemo } from "react";
import { pageToCssLength } from "../../lib/coordinates";
import type { PageModel, TextElement } from "../../types/document";
import { useDocumentSession } from "../document-session/store";
import { ReconstructedTextElement } from "./ReconstructedTextElement";

interface ReconstructedPageProps {
  page: PageModel;
}

/**
 * Computes reflow-adjusted y-positions for all elements on a page.
 *
 * Problem: elements use `position: absolute` with y-coordinates taken directly
 * from the PDF. When the user deletes a bullet point (empties its content),
 * the element is hidden — but all elements below it are still at their original
 * y-coordinates, leaving a blank gap.
 *
 * Solution: sort all elements by y, then scan from top to bottom accumulating
 * the total height "freed" by empty elements. Each visible element's adjusted
 * top = (original top - cumulative freed height). This closes gaps cleanly.
 *
 * Returns: Map<elementId, adjustedTopPx> for every element on the page.
 */
function computeReflowedPositions(
  elements: TextElement[],
  zoom: number,
): Map<string, number> {
  // Work in PDF-space (unzoomed), apply zoom only at render time.
  const sorted = [...elements].sort((a, b) => a.y - b.y);

  const result = new Map<string, number>();
  let freedHeight = 0; // cumulative height of removed elements (PDF units)

  for (const el of sorted) {
    const empty = !el.content.trim();
    if (empty) {
      // Element is removed; its height + a small line-gap is freed for elements below.
      // We use element.height which is the PDF-extracted bounding box height.
      freedHeight += el.height;
    }
    // Adjusted top (PDF units) then scaled to CSS px
    const adjustedTop = (el.y - freedHeight) * zoom;
    result.set(el.id, Math.max(0, adjustedTop));
  }

  return result;
}

export function ReconstructedPage({ page }: ReconstructedPageProps) {
  const zoom = useDocumentSession((state) => state.zoom);
  const selectElement = useDocumentSession((state) => state.selectElement);

  const pageWidthPx = pageToCssLength(page.width, zoom);

  // Compute reflow-adjusted positions whenever page content or zoom changes.
  const adjustedTops = useMemo(
    () => computeReflowedPositions(page.elements, zoom),
    // element contents change when user edits — rebuild positions on each change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page.elements, zoom, page.elements.map((e) => e.content).join("|")],
  );

  // Dynamic page height: bottom of the lowest visible element + padding.
  // This shrinks the page when content is removed instead of leaving blank space.
  const effectivePageHeightPx = useMemo(() => {
    const visibleBottoms = page.elements
      .filter((el) => el.content.trim() !== "")
      .map((el) => {
        const adjustedTop = adjustedTops.get(el.id) ?? el.y * zoom;
        return adjustedTop + el.height * zoom;
      });

    if (visibleBottoms.length === 0) return pageToCssLength(page.height, zoom);

    // Add 48px bottom padding so content doesn't touch the page edge
    return Math.max(...visibleBottoms) + 48;
  }, [page.elements, adjustedTops, page.height, zoom]);

  return (
    <article
      id={`page-${page.pageNumber}`}
      className="relative bg-white"
      style={{
        width: pageWidthPx,
        height: effectivePageHeightPx,
        // overflow:visible so text near the right edge is never clipped
        overflow: "visible",
        boxShadow:
          "0 1px 3px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)",
        // Smooth height transition as elements are removed
        transition: "height 0.2s ease",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) selectElement(null);
      }}
      data-testid={`pdf-page-${page.pageNumber}`}
    >
      {page.elements.map((element) => (
        <ReconstructedTextElement
          key={element.id}
          element={element}
          zoom={zoom}
          adjustedTop={adjustedTops.get(element.id)}
        />
      ))}
    </article>
  );
}
