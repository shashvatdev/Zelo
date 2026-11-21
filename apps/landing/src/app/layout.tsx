import type { Metadata, Viewport } from "next";
import { Geist, Instrument_Serif, Caveat } from "next/font/google";
import "./globals.css";

const sans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const serif = Instrument_Serif({
  variable: "--font-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const hand = Caveat({
  variable: "--font-hand",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zelo: work isn't a list, it's a map",
  description:
    "Zelo connects every ticket to its feature, every feature to its release, and every doc to the work it describes. One living canvas for software teams.",
};

export const viewport: Viewport = {
  themeColor: "#f6f3ec",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${serif.variable} ${hand.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
