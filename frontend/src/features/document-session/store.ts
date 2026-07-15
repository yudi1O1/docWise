import { create } from "zustand";
import type { StoreApi } from "zustand";

import { reconstructStructuredDocument } from "../document-edit/reconstruction";
import type { DocumentElement, DocumentModel, EditorMode, StructuredDocument, DocumentNode } from "../../types/document";
import { deriveReflowedPages } from "./reflow";

interface Snapshot {
  document: DocumentModel;
  structuredDocument: StructuredDocument | null;
  selectedElementId: string | null;
}

interface DocumentSessionState {
  originalFile: File | null;
  document: DocumentModel | null;
  structuredDocument: StructuredDocument | null;
  selectedElementId: string | null;
  mode: EditorMode;
  zoom: number;
  undoStack: Snapshot[];
  redoStack: Snapshot[];
  loadDocument: (file: File, document: DocumentModel) => void;
  reset: () => void;
  setMode: (mode: EditorMode) => void;
  updateStructuredContent: (content: DocumentNode[]) => void;
  setZoom: (zoom: number) => void;
  selectElement: (id: string | null) => void;
  updateText: (elementId: string, content: string) => void;
  updateTextHeight: (elementId: string, height: number, width?: number) => void;
  deleteSelectedElement: () => void;
  undo: () => void;
  redo: () => void;
}

const cloneDocument = (document: DocumentModel): DocumentModel => structuredClone(document);
const cloneStructuredDocument = (document: StructuredDocument | null): StructuredDocument | null =>
  document ? structuredClone(document) : null;

export const useDocumentSession = create<DocumentSessionState>((set, get) => ({
  originalFile: null,
  document: null,
  structuredDocument: null,
  selectedElementId: null,
  mode: "view",
  zoom: 1,
  undoStack: [],
  redoStack: [],
  loadDocument: (file, document) =>
    set({
      originalFile: file,
      document,
      structuredDocument: null,
      selectedElementId: null,
      mode: "view",
      zoom: 1,
      undoStack: [],
      redoStack: [],
    }),
  reset: () =>
    set({
      originalFile: null,
      document: null,
      structuredDocument: null,
      selectedElementId: null,
      mode: "view",
      zoom: 1,
      undoStack: [],
      redoStack: [],
    }),
  setMode: (mode) => {
    const state = get();
    set({
      mode,
      selectedElementId: mode === "quick-edit" ? state.selectedElementId : null,
      structuredDocument:
        mode === "document-edit" && !state.structuredDocument && state.document
          ? reconstructStructuredDocument(state.document)
          : state.structuredDocument,
    });
  },
  updateStructuredContent: (content) => {
    const state = get();
    if (!state.structuredDocument || !state.document) {
      return;
    }
    set({
      structuredDocument: { ...state.structuredDocument, content },
      undoStack: [
        ...state.undoStack,
        {
          document: cloneDocument(state.document),
          structuredDocument: cloneStructuredDocument(state.structuredDocument),
          selectedElementId: state.selectedElementId,
        },
      ],
      redoStack: [],
    });
  },
  setZoom: (zoom) => set({ zoom: Math.min(2.5, Math.max(0.5, zoom)) }),
  selectElement: (id) => set({ selectedElementId: id }),
  updateText: (elementId, content) =>
    mutateDocument(set, get, (element) => (element.id === elementId ? { ...element, content } : element)),
  updateTextHeight: (elementId, height, width) =>
    mutateDocument(
      set,
      get,
      (element) => {
        if (element.id !== elementId) {
          return element;
        }
        if (!element.source.isNew && element.content === element.source.originalText) {
          return {
            ...element,
            height: element.source.originalHeight ?? element.height,
            width: element.source.originalWidth ?? element.width,
          };
        }
        return { ...element, height, width: width ?? element.width };
      },
      {
        skipHistory: true,
      },
    ),
  deleteSelectedElement: () => {
    const selectedElementId = get().selectedElementId;
    if (!selectedElementId) {
      return;
    }
    mutateDocument(
      set,
      get,
      (element) => (element.id === selectedElementId && !element.source.isNew ? { ...element, content: "" } : element),
      { deleteId: selectedElementId },
    );
  },
  undo: () => {
    const { document, selectedElementId, undoStack, redoStack } = get();
    const previous = undoStack[undoStack.length - 1];
    if (!document || !previous) {
      return;
    }
    set({
      document: cloneDocument(previous.document),
      structuredDocument: cloneStructuredDocument(previous.structuredDocument),
      selectedElementId: previous.selectedElementId,
      undoStack: undoStack.slice(0, -1),
      redoStack: [
        ...redoStack,
        { document: cloneDocument(document), structuredDocument: cloneStructuredDocument(get().structuredDocument), selectedElementId },
      ],
    });
  },
  redo: () => {
    const { document, selectedElementId, undoStack, redoStack } = get();
    const next = redoStack[redoStack.length - 1];
    if (!document || !next) {
      return;
    }
    set({
      document: cloneDocument(next.document),
      structuredDocument: cloneStructuredDocument(next.structuredDocument),
      selectedElementId: next.selectedElementId,
      undoStack: [
        ...undoStack,
        { document: cloneDocument(document), structuredDocument: cloneStructuredDocument(get().structuredDocument), selectedElementId },
      ],
      redoStack: redoStack.slice(0, -1),
    });
  },
}));

type StoreSet = StoreApi<DocumentSessionState>["setState"];
type StoreGet = StoreApi<DocumentSessionState>["getState"];

function mutateDocument(
  set: StoreSet,
  get: StoreGet,
  mapper: (element: DocumentElement, pageNumber: number) => DocumentElement,
  options?: { pageNumber?: number; element?: DocumentElement; deleteId?: string; skipHistory?: boolean },
): void {
  const state = get();
  if (!state.document) {
    return;
  }
  const before = cloneDocument(state.document);
  const pages = state.document.pages.map((page) => {
    let elements = page.elements.map((element) => mapper(element, page.pageNumber));
    if (options?.deleteId) {
      elements = elements.filter((element) => element.id !== options.deleteId || !element.source.isNew);
    }
    if (options?.element && page.pageNumber === options.pageNumber) {
      elements = [...elements, options.element];
    }
    return { ...page, elements };
  });
  const reflowedPages = deriveReflowedPages(pages);
  const document = { ...state.document, pageCount: reflowedPages.length, pages: reflowedPages };
  set({
    document,
    selectedElementId: options?.element?.id ?? (options?.deleteId ? null : state.selectedElementId),
    undoStack: options?.skipHistory
      ? state.undoStack
      : [
          ...state.undoStack,
          {
            document: before,
            structuredDocument: cloneStructuredDocument(state.structuredDocument),
            selectedElementId: state.selectedElementId,
          },
        ],
    redoStack: options?.skipHistory ? state.redoStack : [],
  });
}
