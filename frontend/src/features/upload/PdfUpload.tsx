import { useMutation } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";

import { useDocumentSession } from "../document-session/store";
import { parsePdf } from "../../services/api";
import { validatePdfFile } from "./validation";

export function PdfUpload() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const loadDocument = useDocumentSession((state) => state.loadDocument);
  const [clientError, setClientError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: parsePdf,
    onSuccess: (document, file) => loadDocument(file, document),
  });

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setClientError(null);
    const validationError = validatePdfFile(file);
    if (validationError) {
      setClientError(validationError);
      return;
    }
    if (!file) {
      return;
    }
    mutation.mutate(file);
  };

  return (
    <div className="space-y-4">
      <input ref={inputRef} className="hidden" type="file" accept="application/pdf,.pdf" onChange={onFileChange} />
      <button
        type="button"
        className="flex w-full items-center justify-center gap-2 border border-accent bg-accent px-4 py-3 font-medium text-white hover:bg-accent/90 disabled:cursor-wait disabled:opacity-70"
        onClick={() => inputRef.current?.click()}
        disabled={mutation.isPending}
      >
        <Upload className="h-5 w-5" aria-hidden />
        {mutation.isPending ? "Processing" : "Upload PDF"}
      </button>
      {(clientError || mutation.error) && (
        <p className="text-sm font-medium text-signal">{clientError ?? mutation.error?.message}</p>
      )}
    </div>
  );
}
