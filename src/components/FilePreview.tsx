import { useState } from "react";
import { FileText, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export interface PreviewFile {
  url: string;
  name: string;
  type: string;
}

function kind(type: string) {
  if (type.startsWith("image")) return "image" as const;
  if (type.startsWith("video")) return "video" as const;
  if (type.includes("pdf")) return "pdf" as const;
  return "file" as const;
}

/** Renders a visible thumbnail for an image, video, PDF or document; click opens it in full. */
export function FilePreview({
  file,
  onRemove,
  className = "",
}: {
  file: PreviewFile;
  onRemove?: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const k = kind(file.type);

  return (
    <>
      <div className={`relative overflow-hidden rounded-lg border bg-secondary ${className}`}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="block w-full text-left"
          aria-label={`Open ${file.name}`}
        >
          {k === "image" ? (
            <img src={file.url} alt={file.name} className="h-32 w-full object-cover" />
          ) : k === "video" ? (
            <video
              src={file.url}
              className="h-32 w-full bg-black object-cover"
              muted
              playsInline
              preload="auto"
            />
          ) : k === "pdf" ? (
            <span className="block h-32 w-full overflow-hidden bg-card">
              <object data={file.url} type="application/pdf" className="pointer-events-none h-48 w-full">
                <span className="grid h-32 place-items-center text-primary">
                  <FileText className="h-8 w-8" />
                </span>
              </object>
            </span>
          ) : (
            <span className="grid h-32 w-full place-items-center bg-card text-primary">
              <FileText className="h-8 w-8" />
            </span>
          )}
          <span className="block truncate border-t bg-card px-2 py-1 text-xs font-medium text-foreground">
            {file.name}
          </span>
        </button>

        {onRemove ? (
          <button
            type="button"
            aria-label={`Remove ${file.name}`}
            onClick={onRemove}
            className="absolute top-1 right-1 grid h-7 w-7 place-items-center rounded-full bg-background/90 text-destructive shadow-soft"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-auto p-3">
          <DialogTitle className="truncate text-base text-primary">{file.name}</DialogTitle>
          {k === "image" ? (
            <img src={file.url} alt={file.name} className="max-h-[75vh] w-full object-contain" />
          ) : k === "video" ? (
            <video src={file.url} controls autoPlay playsInline preload="auto" className="w-full bg-black" />
          ) : (
            <>
              <iframe src={file.url} title={file.name} className="h-[70vh] w-full rounded-md border" />
              <a
                href={file.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-primary underline"
              >
                Open the full document
              </a>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Preview grid for files chosen in an upload box, before they are sent. */
export function LocalFilePreviews({
  files,
  onRemove,
}: {
  files: File[];
  onRemove?: (index: number) => void;
}) {
  if (files.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {files.map((file, index) => (
        <FilePreview
          key={`${file.name}-${index}`}
          file={{ url: URL.createObjectURL(file), name: file.name, type: file.type }}
          onRemove={onRemove ? () => onRemove(index) : undefined}
        />
      ))}
    </div>
  );
}
