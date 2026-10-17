import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PATHWISE — from uncertainty to a way forward",
  description: "A consent-aware pathway companion for life crossroads.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
