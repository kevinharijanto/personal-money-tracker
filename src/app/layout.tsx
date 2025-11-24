// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Personal Money Tracker",
  description: "Track your personal finances",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  maximumScale: 1,
  userScalable: false,
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const fontStack = `"Segoe UI", Tahoma, Geneva, Verdana, sans-serif`;

  return (
    <html lang="en">
      <body
        className="antialiased"
        style={{
          fontFamily: fontStack,
          margin: 0,
          minHeight: "100vh",
          backgroundColor: "#020617",
        }}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
