import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Myanmar } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const notoSansMyanmar = Noto_Sans_Myanmar({
  weight: ["400", "500", "600", "700"],
  subsets: ["myanmar"],
  variable: "--font-myanmar",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://trusted-marketplace.vercel.app"),
  title: {
    default: "MatchGuard — Buy Safe • Sell Confidently",
    template: "%s | MatchGuard",
  },
  description:
    "A non-custodial, verified-seller marketplace designed to eliminate scams in Myanmar social commerce. Buy Safe • Sell Confidently.",
  applicationName: "MatchGuard",
  keywords: ["MatchGuard", "Myanmar artisans", "handicrafts", "verified sellers", "safe commerce", "non-custodial"],
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/images/branding/matchguard-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "MatchGuard — Buy Safe • Sell Confidently",
    description: "Verified Myanmar artisan marketplace with direct, scam-free commerce.",
    url: "https://trusted-marketplace.vercel.app",
    siteName: "MatchGuard",
    images: [
      {
        url: "/images/branding/matchguard-full-cream.png",
        width: 1024,
        height: 1024,
        alt: "MatchGuard — Buy Safe • Sell Confidently",
      },
    ],
    locale: "en_US",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#133E2D",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${notoSansMyanmar.variable}`}>
      <body className="antialiased selection:bg-jade-100 selection:text-jade-900">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
