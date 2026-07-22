import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StudentHub USM",
  description: "A React and TypeScript recreation of the StudentHub USM sample prototype.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.1.0/dist/tabler-icons.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
