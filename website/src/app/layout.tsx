import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const hubotSans = localFont({
  src: [
    { path: "./fonts/HubotSans-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/HubotSans-ExtraBold.ttf", weight: "800", style: "normal" },
  ],
  variable: "--font-hubot-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Blue Milk Gaming",
  description:
    "Blue Milk Gaming — Star Wars: Unlimited content, the weekly Online Local tournament, and our community leaderboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${hubotSans.variable} antialiased`}>{children}</body>
    </html>
  );
}
