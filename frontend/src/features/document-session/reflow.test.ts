import { describe, expect, it } from "vitest";

import { deriveReflowedPage, deriveReflowedPages } from "./reflow";
import type { PageModel, TextElement } from "../../types/document";

function text(id: string, x: number, y: number, width = 200, height = 20): TextElement {
  const originalText = id;
  return {
    id,
    type: "text",
    content: height === 20 ? originalText : `${originalText} edited`,
    x,
    y,
    width,
    height,
    fontSize: 12,
    fontFamily: "helv",
    fontWeight: "normal",
    color: "#000000",
    alignment: "left",
    rotation: 0,
    source: {
      pageNumber: 1,
      originalText,
      originalX: x,
      originalY: y,
      originalWidth: width,
      originalHeight: 20,
      isNew: false,
    },
  };
}

function textOnPage(pageNumber: number, id: string, x: number, y: number, width = 200, height = 20): TextElement {
  const element = text(id, x, y, width, height);
  return {
    ...element,
    source: {
      ...element.source,
      pageNumber,
    },
  };
}

function page(elements: TextElement[]): PageModel {
  return { pageNumber: 1, width: 600, height: 800, elements };
}

describe("deriveReflowedPage", () => {
  it("shifts downstream same-flow text when one block grows", () => {
    const result = deriveReflowedPage(page([text("A", 50, 100, 200, 40), text("B", 50, 130), text("C", 50, 160)]));

    expect(result.elements.find((element) => element.id === "A")?.y).toBe(100);
    expect(result.elements.find((element) => element.id === "B")?.y).toBe(150);
    expect(result.elements.find((element) => element.id === "C")?.y).toBe(180);
  });

  it("accounts for multiple growing blocks", () => {
    const result = deriveReflowedPage(page([text("A", 50, 100, 200, 40), text("B", 50, 130, 200, 35), text("C", 50, 160)]));

    expect(result.elements.find((element) => element.id === "B")?.y).toBe(150);
    expect(result.elements.find((element) => element.id === "C")?.y).toBe(195);
  });

  it("recalculates from source positions without cumulative drift", () => {
    const grown = deriveReflowedPage(page([text("A", 50, 100, 200, 60), text("B", 50, 130), text("C", 50, 160)]));
    expect(grown.elements.find((element) => element.id === "B")?.y).toBe(170);

    const shrunk = deriveReflowedPage(page([text("A", 50, 100, 200, 20), text("B", 50, 130), text("C", 50, 160)]));
    expect(shrunk.elements.find((element) => element.id === "B")?.y).toBe(130);
    expect(shrunk.elements.find((element) => element.id === "C")?.y).toBe(160);
  });

  it("does not shift unrelated text in another column", () => {
    const result = deriveReflowedPage(page([text("A", 50, 100, 200, 60), text("B", 50, 130), text("C", 360, 130, 180)]));

    expect(result.elements.find((element) => element.id === "B")?.y).toBe(170);
    expect(result.elements.find((element) => element.id === "C")?.y).toBe(130);
  });

  it("preserves original spacing and prevents overlap", () => {
    const result = deriveReflowedPage(page([text("A", 50, 100, 200, 45), text("B", 50, 150), text("C", 50, 178)]));
    const a = result.elements.find((element) => element.id === "A")!;
    const b = result.elements.find((element) => element.id === "B")!;
    const c = result.elements.find((element) => element.id === "C")!;

    expect(b.y).toBe(175);
    expect(c.y).toBe(203);
    expect(b.y).toBeGreaterThanOrEqual(a.y + a.height + 2);
    expect(c.y).toBeGreaterThanOrEqual(b.y + b.height + 2);
  });
});

describe("deriveReflowedPages", () => {
  it("moves same-flow overflow onto the next page", () => {
    const result = deriveReflowedPages([page([text("A", 50, 690, 200, 70), text("B", 50, 730), text("C", 50, 760)])]);

    expect(result).toHaveLength(2);
    expect(result[0].elements.map((element) => element.id)).toEqual(["A"]);
    expect(result[1].elements.map((element) => element.id)).toEqual(["B", "C"]);
    expect(result[1].elements.find((element) => element.id === "B")?.y).toBe(24);
    expect(result[1].elements.find((element) => element.id === "C")?.y).toBe(54);
  });

  it("reuses an existing next page and shifts its same-flow content below overflow", () => {
    const result = deriveReflowedPages([
      page([text("A", 50, 670, 200, 70), text("B", 50, 730)]),
      { ...page([textOnPage(2, "D", 50, 80)]), pageNumber: 2 },
    ]);

    expect(result).toHaveLength(2);
    expect(result[1].elements.map((element) => element.id)).toEqual(["B", "D"]);
    expect(result[1].elements.find((element) => element.id === "B")?.y).toBe(80);
    expect(result[1].elements.find((element) => element.id === "D")?.y).toBe(102);
  });

  it("keeps unrelated columns on their source page when another flow overflows", () => {
    const result = deriveReflowedPages([
      page([text("A", 50, 670, 200, 70), text("B", 50, 730), text("Side", 360, 750, 140)]),
    ]);

    expect(result[0].elements.find((element) => element.id === "Side")?.y).toBe(750);
    expect(result[1].elements.map((element) => element.id)).toEqual(["B"]);
  });
});
