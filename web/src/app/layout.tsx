import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stay-In School · AP School Education",
  description:
    "AI Early Warning & Intervention Intelligence for the School Education Department, Government of Andhra Pradesh.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
