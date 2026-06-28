import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "منشئة ايواء",
  description: "Accommodation Facility Booking"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar">
      <body>{children}</body>
    </html>
  );
}
