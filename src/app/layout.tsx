import type { Metadata, Viewport } from "next";
import { Archivo, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ToastProvider } from "@/components/ui/Toast";

const archivo = Archivo({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["wdth"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#0A0A0B",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "FitMatch AI — Your wardrobe and fitting room",
  description:
    "Keep your wardrobe private, find looks for each occasion and prepare your avatar for a personal 3D fitting room.",
  openGraph: {
    title: "FitMatch AI — Your personal wardrobe",
    description:
      "Your digital wardrobe, personal outfit ideas and an experimental 3D Studio.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-screen bg-bg text-fg flex flex-col font-sans selection:bg-accent-soft selection:text-accent-text">
        <ToastProvider>
          <a href="#app-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-fg focus:px-5 focus:py-3 focus:text-bg">Skip to main content</a>
          <Navbar />
          <div id="app-content" tabIndex={-1} className="flex-1">{children}</div>
          <Footer />
        </ToastProvider>
      </body>
    </html>
  );
}
