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
  title: "TrustedMarketplace — Trust-First E-Commerce",
  description:
    "A non-custodial, verified-seller marketplace designed to eliminate scams in Myanmar social commerce.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#FBF9F5",
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
