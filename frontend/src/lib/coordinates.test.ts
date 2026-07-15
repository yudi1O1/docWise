import { describe, expect, it } from "vitest";

import { cssToPagePoint, pageToCssLength, pageToCssRect } from "./coordinates";

describe("coordinate utilities", () => {
  it("converts page rectangles to css rectangles", () => {
    expect(pageToCssRect({ x: 10, y: 20, width: 30, height: 40 }, 1.5)).toEqual({
      x: 15,
      y: 30,
      width: 45,
      height: 60,
    });
  });

  it("converts css points to page points", () => {
    expect(cssToPagePoint({ x: 30, y: 45 }, 1.5)).toEqual({ x: 20, y: 30 });
  });

  it("converts page lengths", () => {
    expect(pageToCssLength(12, 2)).toBe(24);
  });

});
