import { useEffect, useState } from "react";
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

/** A real video player with buffering feedback and native play/pause controls. */
function VideoPlayer({ file }: { file: PreviewFile }) {
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative w-full bg-black">
      <video
        src={file.url}
        controls
        playsInline
        preload="metadata"
        controlsList="nodownload"
        className="max-h-[70vh] w-full bg-black"
        onWaiting={() => setLoading(true)}
        onPlaying={() => setLoading(false)}
        onCanPlay={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setFailed(true);
        }}
      />
      {loading ? (
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </span>
      ) : null}
      {failed ? (
        <p className="px-2 py-2 text-xs font-semibold text-destructive-foreground">
          This video could not be loaded.{" "}
          <a href={file.url} target="_blank" rel="noreferrer" className="underline">
            Open it directly
          </a>
        </p>
      ) : null}
    </div>
  );
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

  // Back button closes the full-screen viewer instead of leaving the portal.
  useEffect(() => {
    if (!open) return;
    window.history.pushState({ filePreview: file.url }, "");
    const onPop = () => setOpen(false);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [open, file.url]);

  if (k === "video") {
    return (
      <div className={`overflow-hidden rounded-lg border bg-card ${className}`}>
        <VideoPlayer file={file} />
        <div className="flex items-center gap-2 border-t px-2 py-1">
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{file.name}</span>
          {onRemove ? (
            <button
              type="button"
              aria-label={`Remove ${file.name}`}
              onClick={onRemove}
              className="shrink-0 text-destructive"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
    );
  }

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
