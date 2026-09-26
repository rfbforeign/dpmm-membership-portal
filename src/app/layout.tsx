import type { Metadata } from "next";
import { Bricolage_Grotesque, Public_Sans } from "next/font/google";
import "./globals.css";

// Display: a characterful grotesque for headings. Body: Public Sans, built for legibility in forms and tables.
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

const body = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "DPMM Members | Dewan Perniagaan Melayu Malaysia",
    template: "%s | DPMM Members",
  },
  description:
    "Membership management for Dewan Perniagaan Melayu Malaysia (DPMM), Putrajaya chapter.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-dvh bg-cream font-body antialiased">{children}</body>
    </html>
  );
}
