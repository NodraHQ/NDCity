import type { Metadata, Viewport } from "next";
import { SITE_NAME } from "@/config/site";
import "./globals.css";

export const metadata: Metadata = {
  title: SITE_NAME,
  description: "Uma cidadezinha em pixel art onde cada seguidor resgata sua casinha.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#2f6e9e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
