"use client";
/**
 * The app's wallpaper: the trader's own video or image, fixed behind everything.
 * A dim layer in the theme's background colour keeps text readable.
 */
import type { Wallpaper as WallpaperSettings } from "@/lib/types";
import { useBlobUrl } from "./BlobImage";

export function Wallpaper({ w }: { w: WallpaperSettings }) {
  if (w.kind === "none") return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0" style={{ filter: w.blur ? `blur(${w.blur}px)` : undefined, transform: w.blur ? "scale(1.06)" : undefined }}>
        <Upload kind={w.kind} blobId={w.blobId} />
      </div>
      <div className="absolute inset-0" style={{ background: "var(--bg)", opacity: w.dim }} />
    </div>
  );
}

function Upload({ kind, blobId }: { kind: "image" | "video"; blobId: string | null }) {
  const { url } = useBlobUrl(blobId);
  if (!url) return null;
  return kind === "video"
    ? <video src={url} autoPlay muted loop playsInline className="h-full w-full object-cover" />
    // eslint-disable-next-line @next/next/no-img-element
    : <img src={url} alt="" className="h-full w-full object-cover" />;
}
