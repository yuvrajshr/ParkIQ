import type { Metadata } from "next";
import {
  Hanken_Grotesk,
  IBM_Plex_Sans,
  IBM_Plex_Mono,
  Noto_Sans_Devanagari,
  Noto_Sans_Kannada,
} from "next/font/google";
import "./globals.css";
import LangBootstrap from "@/components/LangBootstrap";

const display = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
});

const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "500", "600"],
  variable: "--font-noto-devanagari",
  display: "swap",
});

const notoKannada = Noto_Sans_Kannada({
  subsets: ["kannada"],
  weight: ["400", "500", "600"],
  variable: "--font-noto-kannada",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ParkIQ — Bengaluru Traffic Command",
  description:
    "Price illegal parking by its real traffic damage. Predict, dispatch, and measure — a decision tool for Bengaluru Traffic Police.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable} ${notoDevanagari.variable} ${notoKannada.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Runs before paint — sets dark class and language from localStorage */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('parkiq-dark')==='true')document.documentElement.classList.add('dark')}catch(e){}try{var l=localStorage.getItem('parkiq-lang');if(l==='hi'||l==='kn'||l==='en')document.documentElement.lang=l}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full" suppressHydrationWarning>
        <LangBootstrap />
        {children}
      </body>
    </html>
  );
}
