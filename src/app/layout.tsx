import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { SITE_NAME } from "@/config/site";
import "./globals.css";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID?.replace(/[^\w-]/g, "");

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://ndcity.vercel.app"),
  title: SITE_NAME,
  description: "O Brasil em pixel art: crie sua conta e ganhe sua casinha na sua cidade. Quem chega primeiro vira prefeito!",
  openGraph: {
    title: "NDCity: o Brasil em pixel art",
    description: "Crie sua conta e ganhe sua casinha na sua cidade. Quem chega primeiro vira prefeito!",
    locale: "pt_BR",
    type: "website",
    siteName: SITE_NAME,
  },
  twitter: { card: "summary_large_image", title: "NDCity: o Brasil em pixel art" },
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
      <body>
        {children}
        {GA_ID && (
          <>
            {/* Google Analytics (opcional): só liga se NEXT_PUBLIC_GA_ID estiver configurado */}
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="ga" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA_ID}');`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
