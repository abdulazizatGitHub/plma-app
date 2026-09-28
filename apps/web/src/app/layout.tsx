import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { AppDataProvider } from "@/components/providers/app-data-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { THEME_INIT_SCRIPT } from "@/lib/theme/theme-init-script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
});

export const metadata: Metadata = {
  title: "Life — Personal Tracker",
  description:
    "Track prayers, habits, health, studies, goals, and content creation with calm consistency.",
  applicationName: "Life",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Life",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf2ef" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1210" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Runs before paint to set the theme; can't be React-rendered content. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <AppDataProvider>{children}</AppDataProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
