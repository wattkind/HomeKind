import type { Metadata, Viewport } from "next";
import { SwRegister } from "@/components/sw-register";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://homekind.wattkind.ai"),
  title: "HomeKind — A WattKind AI product",
  description:
    "Keep every device's manuals, receipts and warranty details in one place, so you can find them when you need them.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/assets/favicon.png",
    apple: "/assets/favicon.png",
  },
  openGraph: {
    type: "website",
    siteName: "HomeKind",
    title: "HomeKind — A WattKind AI product",
    description:
      "Keep every device's manuals, receipts and warranty details in one place, so you can find them when you need them.",
    url: "https://homekind.wattkind.ai",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fff6eb",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
