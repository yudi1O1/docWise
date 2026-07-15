import { useEffect, useMemo, type ReactNode } from "react";
import { EditorContent, JSONContent, useEditor } from "@tiptap/react";
import { Extension, Node } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Heading1,
  Heading2,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Pilcrow,
  Redo2,
  Strikethrough,
  Type,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";

import { useDocumentSession } from "../document-session/store";
import type { ColumnNode, DocumentNode, InlineContent, StructuredDocument } from "../../types/document";

const FONT_SIZES = [10, 12, 14, 16, 18, 24, 32];

const FontSize = Extension.create({
  name: "fontSize",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading", "listItem"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => {
              const value = element.style.fontSize;
              return value ? Number.parseFloat(value) : null;
            },
            renderHTML: (attributes) => {
              const fontSize = attributes.fontSize;
              return typeof fontSize === "number" ? { style: `font-size: ${fontSize}px` } : {};
            },
          },
        },
      },
    ];
  },
});

const ColumnSection = Node.create({
  name: "columnSection",
  group: "block",
  content: "documentColumn+",

  parseHTML() {
    return [{ tag: 'div[data-type="column-section"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", { ...HTMLAttributes, "data-type": "column-section", class: "docwise-columns" }, 0];
  },
});

const DocumentColumn = Node.create({
  name: "documentColumn",
  content: "block+",

  parseHTML() {
    return [{ tag: 'div[data-type="document-column"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", { ...HTMLAttributes, "data-type": "document-column", class: "docwise-column" }, 0];
  },
});

export function DocumentEditor() {
  const structuredDocument = useDocumentSession((state) => state.structuredDocument);
  const updateStructuredContent = useDocumentSession((state) => state.updateStructuredContent);
  const tiptapContent = useMemo(() => toTiptapDocument(structuredDocument), [structuredDocument]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
      }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      FontSize,
      ColumnSection,
      DocumentColumn,
    ],
    content: tiptapContent,
    editorProps: {
      attributes: {
        class: "docwise-document-prose",
        "aria-label": "Document edit content",
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      updateStructuredContent(fromTiptapDocument(activeEditor.getJSON(), structuredDocument?.content ?? []));
    },
  });

  useEffect(() => {
    if (!editor || !structuredDocument) {
      return;
    }
    const nextContent = toTiptapDocument(structuredDocument);
    if (JSON.stringify(editor.getJSON()) !== JSON.stringify(nextContent)) {
      editor.commands.setContent(nextContent, { emitUpdate: false });
    }
  }, [editor, structuredDocument]);

  if (!structuredDocument) {
    return null;
  }

  const isScanned = structuredDocument.content.length === 0;
  const firstPage = structuredDocument.pages[0];

  return (
    <section className="grid min-h-0 grid-rows-[auto_1fr] bg-[#e8e2d6]" data-testid="document-edit-workspace">
      <DocumentFormatToolbar editor={editor} disabled={isScanned} />
      <div
        className="min-h-0 overflow-auto px-6 py-8"
        data-testid="document-edit-scroll-region"
      >
        <div
          className="mx-auto overflow-visible bg-white shadow-sm"
          style={{
            width: firstPage ? Math.min(firstPage.width, 820) : 760,
            minHeight: firstPage ? firstPage.height : 980,
          }}
          data-testid="document-edit-page"
        >
          {isScanned ? (
            <div className="p-16 text-sm leading-6 text-ink/75" role="status">
              This PDF appears to contain scanned images. OCR is required to make the text editable.
            </div>
          ) : (
            <EditorContent editor={editor} />
          )}
        </div>
      </div>
    </section>
  );
}

interface DocumentFormatToolbarProps {
  editor: ReturnType<typeof useEditor>;
  disabled: boolean;
}

function DocumentFormatToolbar({ editor, disabled }: DocumentFormatToolbarProps) {
  const unavailable = disabled || !editor;
  const activeFontSize = Number(editor?.getAttributes("paragraph").fontSize ?? editor?.getAttributes("heading").fontSize ?? 14);

  const setFontSize = (fontSize: number) => {
    if (!editor) {
      return;
    }
    if (editor.isActive("heading")) {
      editor.chain().focus().updateAttributes("heading", { fontSize }).run();
      return;
    }
    editor.chain().focus().updateAttributes("paragraph", { fontSize }).run();
  };

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1 border-b border-line bg-white px-3 py-2">
      <FormatButton label="Undo" disabled={unavailable || !editor?.can().undo()} active={false} onClick={() => editor?.chain().focus().undo().run()}>
        <Undo2 className="h-4 w-4" aria-hidden />
      </FormatButton>
      <FormatButton label="Redo" disabled={unavailable || !editor?.can().redo()} active={false} onClick={() => editor?.chain().focus().redo().run()}>
        <Redo2 className="h-4 w-4" aria-hidden />
      </FormatButton>
      <ToolbarDivider />
      <FormatButton label="Bold" disabled={unavailable} active={Boolean(editor?.isActive("bold"))} onClick={() => editor?.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" aria-hidden />
      </FormatButton>
      <FormatButton label="Italic" disabled={unavailable} active={Boolean(editor?.isActive("italic"))} onClick={() => editor?.chain().focus().toggleItalic().run()}>
        <Italic className="h-4 w-4" aria-hidden />
      </FormatButton>
      <FormatButton
        label="Underline"
        disabled={unavailable}
        active={Boolean(editor?.isActive("underline"))}
        onClick={() => editor?.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="h-4 w-4" aria-hidden />
      </FormatButton>
      <FormatButton
        label="Strikethrough"
        disabled={unavailable}
        active={Boolean(editor?.isActive("strike"))}
        onClick={() => editor?.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="h-4 w-4" aria-hidden />
      </FormatButton>
      <ToolbarDivider />
      <FormatButton
        label="Paragraph"
        disabled={unavailable}
        active={Boolean(editor?.isActive("paragraph"))}
        onClick={() => editor?.chain().focus().setParagraph().run()}
      >
        <Pilcrow className="h-4 w-4" aria-hidden />
      </FormatButton>
      <FormatButton
        label="Heading 1"
        disabled={unavailable}
        active={Boolean(editor?.isActive("heading", { level: 1 }))}
        onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="h-4 w-4" aria-hidden />
      </FormatButton>
      <FormatButton
        label="Heading 2"
        disabled={unavailable}
        active={Boolean(editor?.isActive("heading", { level: 2 }))}
        onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-4 w-4" aria-hidden />
      </FormatButton>
      <label className="ml-1 flex h-9 items-center gap-2 border border-line bg-white px-2 text-sm" title="Font size">
        <Type className="h-4 w-4" aria-hidden />
        <select
          className="bg-transparent text-sm outline-none"
          value={FONT_SIZES.includes(activeFontSize) ? activeFontSize : 14}
          disabled={unavailable}
          onChange={(event) => setFontSize(Number(event.target.value))}
          aria-label="Font size"
        >
          {FONT_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <ToolbarDivider />
      <FormatButton
        label="Bullet list"
        disabled={unavailable}
        active={Boolean(editor?.isActive("bulletList"))}
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" aria-hidden />
      </FormatButton>
      <FormatButton
        label="Numbered list"
        disabled={unavailable}
        active={Boolean(editor?.isActive("orderedList"))}
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" aria-hidden />
      </FormatButton>
      <ToolbarDivider />
      <FormatButton label="Align left" disabled={unavailable} active={Boolean(editor?.isActive({ textAlign: "left" }))} onClick={() => editor?.chain().focus().setTextAlign("left").run()}>
        <AlignLeft className="h-4 w-4" aria-hidden />
      </FormatButton>
      <FormatButton label="Align center" disabled={unavailable} active={Boolean(editor?.isActive({ textAlign: "center" }))} onClick={() => editor?.chain().focus().setTextAlign("center").run()}>
        <AlignCenter className="h-4 w-4" aria-hidden />
      </FormatButton>
      <FormatButton label="Align right" disabled={unavailable} active={Boolean(editor?.isActive({ textAlign: "right" }))} onClick={() => editor?.chain().focus().setTextAlign("right").run()}>
        <AlignRight className="h-4 w-4" aria-hidden />
      </FormatButton>
      <FormatButton label="Justify" disabled={unavailable} active={Boolean(editor?.isActive({ textAlign: "justify" }))} onClick={() => editor?.chain().focus().setTextAlign("justify").run()}>
        <AlignJustify className="h-4 w-4" aria-hidden />
      </FormatButton>
      <div className="ml-auto flex items-center gap-2 text-xs text-ink/60">
        <Highlighter className="h-4 w-4" aria-hidden />
        Flow edit
      </div>
    </div>
  );
}

interface FormatButtonProps {
  label: string;
  disabled: boolean;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}

function FormatButton({ label, disabled, active, onClick, children }: FormatButtonProps) {
  return (
    <button
      className={`toolbar-button ${active ? "border-ink bg-ink text-white" : ""}`}
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="mx-1 h-6 w-px bg-line" aria-hidden />;
}

function toTiptapDocument(document: StructuredDocument | null): JSONContent {
  return {
    type: "doc",
    content: document?.content.flatMap(toTiptapNode) ?? [],
  };
}

function toTiptapNode(node: DocumentNode): JSONContent[] {
  if (node.type === "heading") {
    return [
      {
        type: "heading",
        attrs: { level: node.level, textAlign: node.style.alignment ?? "left", fontSize: node.style.fontSize ?? null },
        content: toTiptapInline(node.content),
      },
    ];
  }

  if (node.type === "paragraph" || node.type === "fixedLayout") {
    return [
      {
        type: "paragraph",
        attrs: { textAlign: node.style?.alignment ?? "left", fontSize: node.style?.fontSize ?? null },
        content: toTiptapInline(node.content),
      },
    ];
  }

  if (node.type === "columns") {
    return [
      {
        type: "columnSection",
        content: node.columns.map((column) => ({
          type: "documentColumn",
          content: column.content.flatMap(toTiptapNode),
        })),
      },
    ];
  }

  return [
    {
      type: node.type,
      content: node.items.map((item) => ({
        type: "listItem",
        content: [
          {
            type: "paragraph",
            attrs: { fontSize: item.style?.fontSize ?? node.style?.fontSize ?? null },
            content: toTiptapInline(item.content),
          },
        ],
      })),
    },
  ];
}

function toTiptapInline(content: InlineContent[]): JSONContent[] {
  return content
    .filter((part) => part.text.length > 0)
    .map((part) => ({
      type: "text",
      text: part.text,
      marks: part.marks?.map((mark) => ({ type: mark })) ?? undefined,
    }));
}

function fromTiptapDocument(document: JSONContent, previousNodes: DocumentNode[]): DocumentNode[] {
  return (document.content ?? []).flatMap((node, index) => fromTiptapNode(node, index, previousNodes[index]));
}

function fromTiptapNode(node: JSONContent, index: number, previousNode?: DocumentNode): DocumentNode[] {
  if (node.type === "heading") {
    return [
      {
        id: previousNode?.id ?? `doc-heading-${index}`,
        type: "heading",
        level: normalizeHeadingLevel(node.attrs?.level),
        content: extractInlineContent(node),
        style: {
          ...previousNode?.style,
          alignment: normalizeAlignment(node.attrs?.textAlign),
          fontSize: normalizeFontSize(node.attrs?.fontSize, previousNode?.style?.fontSize),
          fontWeight: "bold",
        },
        sourcePage: previousNode?.sourcePage,
        sourceBounds: previousNode?.sourceBounds,
        sourceText: previousNode?.sourceText,
      },
    ];
  }

  if (node.type === "bulletList" || node.type === "orderedList") {
    const previousItems = previousNode?.type === node.type ? previousNode.items : [];
    return [
      {
        id: previousNode?.id ?? `doc-list-${index}`,
        type: node.type,
        items: (node.content ?? []).map((item, itemIndex) => ({
          id: previousItems[itemIndex]?.id ?? `doc-list-${index}-${itemIndex}`,
          content: extractInlineContent(item),
          style: previousItems[itemIndex]?.style,
          sourcePage: previousItems[itemIndex]?.sourcePage,
          sourceBounds: previousItems[itemIndex]?.sourceBounds,
          sourceText: previousItems[itemIndex]?.sourceText,
        })),
        style: previousNode?.style,
        sourcePage: previousNode?.sourcePage,
        sourceBounds: previousNode?.sourceBounds,
        sourceText: previousNode?.sourceText,
      },
    ];
  }

  if (node.type === "columnSection") {
    const previousColumns = previousNode?.type === "columns" ? previousNode.columns : [];
    return [
      {
        id: previousNode?.id ?? `doc-columns-${index}`,
        type: "columns",
        columns: (node.content ?? []).map((column, columnIndex) => fromTiptapColumn(column, columnIndex, previousColumns[columnIndex])),
        style: previousNode?.style,
        sourcePage: previousNode?.sourcePage,
        sourceBounds: previousNode?.sourceBounds,
        sourceText: previousNode?.sourceText,
      },
    ];
  }

  if (node.type === "paragraph") {
    return [
      {
        id: previousNode?.id ?? `doc-paragraph-${index}`,
        type: "paragraph",
        content: extractInlineContent(node),
        style: {
          ...previousNode?.style,
          alignment: normalizeAlignment(node.attrs?.textAlign),
          fontSize: normalizeFontSize(node.attrs?.fontSize, previousNode?.style?.fontSize),
        },
        sourcePage: previousNode?.sourcePage,
        sourceBounds: previousNode?.sourceBounds,
        sourceText: previousNode?.sourceText,
      },
    ];
  }

  return [];
}

function fromTiptapColumn(node: JSONContent, index: number, previousColumn?: ColumnNode): ColumnNode {
  return {
    id: previousColumn?.id ?? `doc-column-${index}`,
    content: (node.content ?? []).flatMap((child, childIndex) => fromTiptapNode(child, childIndex, previousColumn?.content[childIndex])),
    style: previousColumn?.style,
    sourcePage: previousColumn?.sourcePage,
    sourceBounds: previousColumn?.sourceBounds,
    sourceText: previousColumn?.sourceText,
  };
}

function extractInlineContent(node: JSONContent): InlineContent[] {
  const text = collectTextNodes(node);
  return text.length > 0 ? text : [{ type: "text", text: "" }];
}

function collectTextNodes(node: JSONContent): InlineContent[] {
  if (node.type === "text") {
    return [
      {
        type: "text",
        text: node.text ?? "",
        marks: node.marks?.map((mark) => mark.type).filter(isSupportedMark),
      },
    ];
  }

  return (node.content ?? []).flatMap(collectTextNodes);
}

function normalizeHeadingLevel(value: unknown): 1 | 2 | 3 | 4 | 5 | 6 {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 || value === 6 ? value : 2;
}

function normalizeAlignment(value: unknown): "left" | "center" | "right" | "justify" {
  return value === "center" || value === "right" || value === "justify" ? value : "left";
}

function normalizeFontSize(value: unknown, fallback: number | undefined): number | undefined {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseFloat(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isSupportedMark(mark: string | undefined): mark is "bold" | "italic" | "underline" | "strike" {
  return mark === "bold" || mark === "italic" || mark === "underline" || mark === "strike";
}
