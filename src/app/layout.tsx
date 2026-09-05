import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clip Campaigns",
  description: "Campaign submissions and payout management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
