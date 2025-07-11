import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TRPCQueryProvider } from "../components/providers/providers";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { LocaleProvider } from "@/providers/locale-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Savyy",
  description: "Personal finance management application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <TRPCQueryProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <LocaleProvider>
              {children}
            </LocaleProvider>
          </ThemeProvider>
        </TRPCQueryProvider>
      </body>
    </html>
  );
}
