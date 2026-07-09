import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeScript } from "@/components/ui/ThemeScript";

export const metadata: Metadata = {
  title: {
    default: "Crewfall — social deduction in deep space",
    template: "%s · Crewfall",
  },
  description:
    "Crewfall is an open-source multiplayer social deduction game. Finish your tasks, find the impostors, survive the Helion.",
  applicationName: "Crewfall",
  keywords: ["multiplayer", "social deduction", "browser game", "impostor"],
};

export const viewport: Viewport = {
  themeColor: "#0a0e1a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="bg-space-950 text-space-200 min-h-dvh antialiased">{children}</body>
    </html>
  );
}
