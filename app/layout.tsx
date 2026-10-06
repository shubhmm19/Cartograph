import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { serverEnv } from "@/lib/env";
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
  title: "Cartograph",
  description: "See how a codebase fits together.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Evaluating the server environment here makes missing configuration fail before a page renders.
  void serverEnv.clerkSecretKey;

  return (
    <html
      lang="en"
      data-theme="light"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Script id="theme-init" strategy="beforeInteractive">
          {`(() => {
            const root = document.documentElement;
            let preference = 'system';
            try {
              const saved = localStorage.getItem('cartograph-theme');
              if (saved === 'light' || saved === 'dark') preference = saved;
            } catch {}
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            root.dataset.themePreference = preference;
            root.dataset.theme = preference === 'system' ? (isDark ? 'dark' : 'light') : preference;
          })();`}
        </Script>
        <ClerkProvider
          publishableKey={serverEnv.clerkPublishableKey}
          signInForceRedirectUrl="/workspace"
          signUpForceRedirectUrl="/workspace"
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
