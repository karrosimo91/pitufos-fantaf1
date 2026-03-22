import type { Metadata, Viewport } from "next";
import { Inter, Oswald, JetBrains_Mono } from "next/font/google";
import RegisterSW from "./components/RegisterSW";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Los Pitufos FantaF1 — Stagione 2026",
  description: "Fantasy F1 ibrido: fantasy manager + pronostici. Gratuito e aperto a tutti.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LP FantaF1",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon-512.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#E8002D",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body
        className={`${inter.variable} ${oswald.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
