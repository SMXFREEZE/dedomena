import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { BackgroundLines } from "@/components/ui/background-lines";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dedomena | Intelligence & Engineering",
  description: "Advanced Document Intelligence and Data Engineering Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="h-full bg-background text-foreground tracking-tight flex flex-col">
        <BackgroundLines />
        <div className="relative z-10 flex flex-col h-full">
          {children}
        </div>
        <Toaster theme="dark" position="bottom-right" />
      </body>
    </html>
  );
}
