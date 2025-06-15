// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter, Anonymous_Pro } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
const spaceMono = Anonymous_Pro({ 
  subsets: ["latin"],
  weight: ['400', '700'],
  variable: '--font-terminal',
});

export const metadata: Metadata = {
  title: "Bashamole",
  description: "A game to practice Unix navigation by hunting moles in the filesystem",
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png' },
    ],
    other: [
      {
        rel: 'android-chrome-192x192',
        url: '/android-chrome-192x192.png',
      },
      {
        rel: 'android-chrome-512x512',
        url: '/android-chrome-512x512.png',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full ${spaceMono.variable}`}>
      <body className={`${inter.className} h-full`}>{children}</body>
    </html>
  );
}