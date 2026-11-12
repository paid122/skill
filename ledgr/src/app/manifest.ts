import type { MetadataRoute } from "next";

/** Lets browsers install Ledgr as an app (its own window and icon). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ledgr — Trading journal",
    short_name: "Ledgr",
    description: "A private trading journal for reflective, disciplined traders.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
