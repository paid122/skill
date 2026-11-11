"use client";
import { ImageOff } from "lucide-react";
import { useEffect, useState } from "react";
import { getBlob } from "@/lib/store";
import { cx } from "@/lib/util";

const cache = new Map<string, string>();

export function useBlobUrl(blobId: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(blobId ? cache.get(blobId) ?? null : null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (!blobId) return;
    if (cache.has(blobId)) { setUrl(cache.get(blobId)!); return; }
    let alive = true;
    getBlob(blobId).then((b) => {
      if (!alive) return;
      if (!b) { setMissing(true); return; }
      const u = URL.createObjectURL(b);
      cache.set(blobId, u);
      setUrl(u);
    }).catch(() => alive && setMissing(true));
    return () => { alive = false; };
  }, [blobId]);
  return { url, missing };
}

/** Converts a stored blob to a data URL (used for PNG export, where object URLs may not inline). */
export async function blobToDataUrl(blobId: string): Promise<string | null> {
  const b = await getBlob(blobId);
  if (!b) return null;
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => resolve(null);
    r.readAsDataURL(b);
  });
}

export function BlobImage({ blobId, alt, className }: { blobId: string; alt: string; className?: string }) {
  const { url, missing } = useBlobUrl(blobId);
  if (missing) return <div className={cx("grid place-items-center bg-card-2 text-muted", className)}><ImageOff size={18} /></div>;
  if (!url) return <div className={cx("skeleton", className)} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={cx("object-cover", className)} />;
}
