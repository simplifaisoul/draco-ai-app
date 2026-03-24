import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AuthProvider } from "./lib/AuthContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Draco AI — Your AI Has Its Own Computer",
  description: "Draco doesn't just answer questions. It has a real Ubuntu machine it controls — installing software, running commands, managing servers — while you watch, live. Chat, images, web search, and direct terminal access. Free to start.",
  keywords: ["AI Linux agent", "learn Linux with AI", "AI terminal", "AI sysadmin", "Linux automation", "Draco AI", "AI agent Ubuntu", "AI that runs commands", "Linux learning tool", "AI server management"],
  openGraph: {
    title: "Draco AI — Meet the AI That Runs Linux",
    description: "An AI with its own Ubuntu computer. Ask it to set up servers, learn the terminal, or automate anything. Watch it work live.",
    type: "website",
    siteName: "Draco AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Draco AI — Meet the AI That Runs Linux",
    description: "An AI with its own computer. It doesn't explain Linux — it runs it.",
  },
  icons: {
    icon: "/dragon_final.png",
    apple: "/dragon_final.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: 'resizes-content',
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          {children}
        </AuthProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

