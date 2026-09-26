import { FileSpreadsheet, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { parseContainerFile, type ParseResult } from "@/lib/excel-parse";
import { cn } from "@/lib/utils";

export function FlexiUpload({ onParsed }: { onParsed: (result: ParseResult, fileName: string) => void }) {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const result = await parseContainerFile(file);
      onParsed(result, file.name);
      if (result.rows.length) {
        toast.success(`${result.rows.length} container numbers read from ${file.name}`);
      }
      result.warnings.forEach((w) => toast.warning(w, { duration: 8000 }));
    } catch (e) {
      toast.error(`Could not read that file: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void handle(e.dataTransfer.files?.[0]);
      }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-card px-6 py-10 text-center transition-colors",
        dragging && "border-accent bg-accent/10",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.xlsm,.csv"
        className="hidden"
        onChange={(e) => {
          void handle(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {busy ? (
        <FileSpreadsheet className="size-8 animate-pulse text-accent" />
      ) : (
        <UploadCloud className="size-8 text-muted-foreground" />
      )}
      <p className="text-sm font-medium">
        {busy ? "Reading file…" : "Drop an Excel or CSV file here, or click to browse"}
      </p>
      <p className="text-xs text-muted-foreground">
        Works with .xlsx, .xls and .csv — container numbers are found even when headings differ.
      </p>
    </div>
  );
}
