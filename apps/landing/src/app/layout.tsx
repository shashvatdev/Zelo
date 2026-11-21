import type { Metadata, Viewport } from "next";
import { Geist, Instrument_Serif, Caveat } from "next/font/google";
import CursorLabel from "@/components/CursorLabel";
import { SITE, SITE_URL } from "@/lib/site";
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
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE.title,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  category: "Project management software",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE.name,
    title: SITE.shortTitle,
    description: SITE.description,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.shortTitle,
    description: SITE.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#f6f3ec",
  colorScheme: "light",
};

/**
 * Runs before first paint. The full-screen film (entry gate + intro) is only for direct visits.
 * Visitors who arrive from a search engine land straight on the page: Google demotes pages that
 * cover their content right after a click from search. Reduced-motion users also skip it, and so
 * does anyone who has already seen it in this tab.
 */
const cinematicScript = `try{var r=document.referrer||"";var fromSearch=/^https?:\\/\\/([^/]+\\.)?(google|bing|duckduckgo|yahoo|yandex|baidu|ecosia|brave|startpage|qwant|perplexity|chatgpt)\\./i.test(r);var calm=window.matchMedia("(prefers-reduced-motion: reduce)").matches;var seen=false;try{seen=sessionStorage.getItem("zelo-film-seen")==="1"}catch(e){}if(!fromSearch&&!calm&&!seen)document.documentElement.classList.add("cine")}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${serif.variable} ${hand.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: cinematicScript }} />
      </head>
      <body>
        {children}
        <CursorLabel />
      </body>
    </html>
  );
}
