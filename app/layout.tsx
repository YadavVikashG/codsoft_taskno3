import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CareerHub | Your next chapter starts here",
  description: "Thoughtful job search and recruitment, all in one place.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}