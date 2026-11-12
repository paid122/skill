import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource/newsreader/400.css";
import "@fontsource/newsreader/400-italic.css";
import "@fontsource/newsreader/500.css";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Ledgr", template: "%s · Ledgr" },
  description: "Discipline over impulse. A private trading journal and performance review workspace.",
  applicationName: "Ledgr",
};

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="midnight" data-site-theme="light" suppressHydrationWarning>
      <head>
        {/* Apply the saved website theme before first paint (no flash). */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("ledgr.siteTheme");if(t==="dark"||t==="light")document.documentElement.dataset.siteTheme=t}catch(e){}` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
