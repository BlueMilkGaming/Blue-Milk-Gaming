import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";

// Public by nature (visible in page source on every GA site), so no env var.
const gaMeasurementId = "G-4ZK4P1GT8Q";

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
    "Blue Milk Gaming is a Star Wars: Unlimited content org running the weekly Online Local tournament and a community leaderboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${hubotSans.variable} antialiased`}>
        {children}
        {process.env.NODE_ENV === "production" && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaMeasurementId}');`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
