import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic, IBM_Plex_Mono } from "next/font/google";
import Providers from "./providers";
import { BOOT_SCRIPT } from "./boot-script";
import "@/index.css";

const sans = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-latin",
  display: "swap",
});

const arabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Math infini",
  description: "Plateforme d'enseignement des mathématiques : cours, exercices, quiz et suivi des élèves.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Math infini", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: { icon: "/favicon.ico", apple: "/assets/header_logo.png" },
  other: { google: "notranslate" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0d10" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      translate="no"
      className={`notranslate ${sans.variable} ${arabic.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://qsroveljtrscsgkykmfh.supabase.co" crossOrigin="" />
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
