// Root application layout that wires global styles, fonts, and toast notifications.

import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

// Configure Geist Sans font with Latin subset
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Configure Geist Mono font with Latin subset
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Configure Inter font with Latin subset
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

// Define metadata for the application
export const metadata: Metadata = {
  title: "TAMU-OSSF Center SCADA",
  description: "Texas A&M On-Site Sewage Facility Center SCADA System",
};

// Root layout component that wraps all pages
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* Apply font variables and antialiasing to the body */}
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Toast notifications component */}
        <Toaster />
        {/* Render child components/pages */}
        {children}
      </body>
    </html>
  );
}
