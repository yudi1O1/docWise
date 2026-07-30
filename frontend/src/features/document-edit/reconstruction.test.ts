import { describe, expect, it } from "vitest";

import { reconstructStructuredDocument } from "./reconstruction";
import type { DocumentModel, TextElement } from "../../types/document";

function element(
  id: string,
  content: string,
  x: number,
  y: number,
  width: number,
  height = 12,
  options?: Partial<Pick<TextElement, "fontSize" | "fontFamily" | "fontWeight" | "fontStyle">>,
): TextElement {
  return {
    id,
    type: "text",
    content,
    x,
    y,
    width,
    height,
    fontSize: options?.fontSize ?? 12,
    fontFamily: options?.fontFamily ?? "helv",
    fontWeight: options?.fontWeight ?? "normal",
    fontStyle: options?.fontStyle ?? "normal",
    color: "#000000",
    alignment: "left",
    rotation: 0,
    source: {
      pageNumber: 1,
      originalText: content,
      originalX: x,
      originalY: y,
      originalWidth: width,
      originalHeight: height,
      isNew: false,
    },
  };
}

function document(elements: TextElement[]): DocumentModel {
  return {
    sourceType: "pdf",
    fileName: "sample.pdf",
    pageCount: 1,
    pages: [{ pageNumber: 1, width: 600, height: 800, elements }],
  };
}

function textOfFirstNode(model: DocumentModel): string {
  const node = reconstructStructuredDocument(model).content[0];
  const joinContent = (items: Array<{ text: string }>) => items.map((i) => i.text).join("");
  switch (node.type) {
    case "bulletList":
    case "orderedList":
      return joinContent(node.items[0].content);
    case "paragraph":
    case "heading":
    case "fixedLayout":
      return joinContent(node.content);
    default:
      return "";
  }
}

describe("reconstructStructuredDocument", () => {
  it("reconstructs same-line PDF fragments without fragmenting words", () => {
    const result = textOfFirstNode(document([element("a", "Doc", 50, 100, 24), element("b", "Wise", 74, 100.5, 30)]));

    expect(result).toBe("DocWise");
  });

  it("preserves spaces between fragments when the horizontal gap indicates a word boundary", () => {
    const result = textOfFirstNode(document([element("a", "Hello", 50, 100, 34), element("b", "world", 96, 100, 34)]));

    expect(result).toBe("Hello world");
  });

  it("does not merge unrelated columns into one paragraph", () => {
    const result = reconstructStructuredDocument(
      document([element("left", "Left column", 50, 100, 90), element("right", "Right column", 360, 100, 100)]),
    );

    const columns = result.content[0].type === "columns" ? result.content[0].columns : result.content;
    expect(columns).toHaveLength(2);
  });

  it("groups consecutive compatible lines into a paragraph", () => {
    const result = textOfFirstNode(document([element("a", "First line", 50, 100, 120), element("b", "continues here", 50, 116, 140)]));

    expect(result).toBe("First line continues here");
  });

  it("keeps large vertical gaps as separate paragraphs", () => {
    const result = reconstructStructuredDocument(
      document([element("a", "First paragraph", 50, 100, 130), element("b", "Second paragraph", 50, 150, 150)]),
    );

    expect(result.content).toHaveLength(2);
  });

  it("reconstructs bullet markers as list items attached to their content", () => {
    const result = reconstructStructuredDocument(document([element("bullet", "-", 50, 100, 8), element("item", "Attached item", 66, 100, 110)]));

    expect(result.content[0]).toMatchObject({
      type: "bulletList",
      items: [{ content: [{ text: "Attached item" }] }],
    });
  });

  it("groups consecutive bullet lines into one bullet list", () => {
    const result = reconstructStructuredDocument(
      document([
        element("a", "\u2022 First item", 50, 100, 120),
        element("b", "\u2022 Second item", 50, 118, 140),
        element("c", "\u2022 Third item", 50, 136, 130),
      ]),
    );

    expect(result.content[0]).toMatchObject({
      type: "bulletList",
      items: [{ content: [{ text: "First item" }] }, { content: [{ text: "Second item" }] }, { content: [{ text: "Third item" }] }],
    });
  });

  it("groups ordered list lines into one ordered list", () => {
    const result = reconstructStructuredDocument(
      document([element("a", "1. First", 50, 100, 90), element("b", "2. Second", 50, 118, 100), element("c", "3. Third", 50, 136, 90)]),
    );

    expect(result.content[0]).toMatchObject({
      type: "orderedList",
      items: [{ content: [{ text: "First" }] }, { content: [{ text: "Second" }] }, { content: [{ text: "Third" }] }],
    });
  });

  it("keeps wrapped visual lines as one paragraph", () => {
    const result = reconstructStructuredDocument(
      document([
        element("a", "This is one long paragraph that wraps", 50, 100, 220),
        element("b", "onto another line in the PDF.", 50, 116, 190),
      ]),
    );

    expect(result.content).toHaveLength(1);
    expect(textOfFirstNode(document([element("a", "This is one long paragraph that wraps", 50, 100, 220), element("b", "onto another line in the PDF.", 50, 116, 190)]))).toBe(
      "This is one long paragraph that wraps onto another line in the PDF.",
    );
  });

  it("represents side-by-side regions as columns without interleaving lines", () => {
    const result = reconstructStructuredDocument(
      document([
        element("skills", "Skills", 50, 100, 60, 14, { fontWeight: "bold" }),
        element("react", "React", 50, 124, 50),
        element("node", "Node.js", 50, 142, 60),
        element("education", "Education", 340, 100, 90, 14, { fontWeight: "bold" }),
        element("msc", "MSc", 340, 124, 40),
        element("bsc", "BSc", 340, 142, 40),
      ]),
    );

    expect(result.content[0]).toMatchObject({
      type: "columns",
      columns: [
        {
          content: [
            { content: expect.arrayContaining([expect.objectContaining({ text: "Skills" })]) },
            { content: expect.arrayContaining([expect.objectContaining({ text: "React" }), expect.objectContaining({ text: "Node.js" })]) },
          ],
        },
        {
          content: [
            { content: expect.arrayContaining([expect.objectContaining({ text: "Education" })]) },
            { content: expect.arrayContaining([expect.objectContaining({ text: "MSc" }), expect.objectContaining({ text: "BSc" })]) },
          ],
        },
      ],
    });
  });

  it("preserves relative typography and style marks", () => {
    const result = reconstructStructuredDocument(
      document([
        element("heading", "Large heading", 50, 80, 180, 24, { fontSize: 24, fontWeight: "bold", fontFamily: "Helvetica-Bold" }),
        element("subheading", "Medium subheading", 50, 120, 170, 18, { fontSize: 16 }),
        element("body", "Normal body", 50, 150, 120),
        element("italic", "Italic note", 50, 168, 90, 12, { fontFamily: "Times-Italic", fontStyle: "italic" }),
      ]),
    );

    expect(result.content[0]).toMatchObject({ type: "heading", level: 1, style: { fontSize: 24 } });
    expect(result.content[0].type === "heading" ? result.content[0].content[0].marks : []).toContain("bold");
    expect(result.content[3].type === "paragraph" ? result.content[3].content[0].marks : []).toContain("italic");
  });

  it("does not merge top header name and right-aligned contact info into one line", () => {
    const result = reconstructStructuredDocument(
      document([
        element("name", "UDDESHYA RAJ", 50, 40, 150, 20, { fontWeight: "bold" }),
        element("phone", "+91-7278066976", 400, 40, 120, 12),
      ]),
    );

    expect(result.content[0].type === "columns" ? result.content[0].columns : result.content).toHaveLength(2);
  });

  it("detects tight columns with column gaps below 72pt", () => {
    const result = reconstructStructuredDocument(
      document([
        element("col1", "Column One text", 50, 100, 100),
        element("col2", "Column Two text", 180, 100, 100),
      ]),
    );

    expect(result.content[0].type).toBe("columns");
  });
});
