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
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "HomeKind",
    title: "HomeKind — A WattKind AI product",
    description:
      "Keep every device's manuals, receipts and warranty details in one place, so you can find them when you need them.",
    url: "https://homekind.wattkind.ai",
    images: [
      {
        url: "/assets/brand/social-card.png",
        width: 1200,
        height: 630,
        alt: "HomeKind — Home support that remembers for you.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "HomeKind — A WattKind AI product",
    description:
      "Keep every device's manuals, receipts and warranty details in one place, so you can find them when you need them.",
    images: ["/assets/brand/social-card.png"],
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
