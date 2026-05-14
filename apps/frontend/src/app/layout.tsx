import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tow-seasons",
  description: "Serviced Apartments Booking"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar">
      <body>{children}</body>
    </html>
  );
}
