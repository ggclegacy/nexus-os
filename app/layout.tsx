import type { Metadata } from "next";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Command | Nexus OS",
    template: "%s | Nexus OS",
  },
  description:
    "A private personal command system for running today with clarity.",
  applicationName: "Nexus OS",
  icons: {
    icon: "/nexus-emblem-96.png",
    shortcut: "/nexus-emblem-96.png",
    apple: "/nexus-emblem-192.png",
  },
  openGraph: {
    type: "website",
    siteName: "Nexus OS",
    title: "Nexus OS",
    description:
      "A private personal command and calendar system for running today with clarity.",
    images: [
      {
        url: "/nexus-command-calendar-social.png",
        width: 1200,
        height: 630,
        alt: "Nexus OS Command and Calendar timeline",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nexus OS",
    description:
      "A private personal command and calendar system for running today with clarity.",
    images: ["/nexus-command-calendar-social.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="nexus">
      <body>{children}</body>
    </html>
  );
}
