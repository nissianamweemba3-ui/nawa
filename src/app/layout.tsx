import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "AFIS — AI-Powered Fleet Intelligence System | Bantu Track",
  description: "Enterprise fleet tracking, SIM management, and AI-powered analytics for the SADC region",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  )
}
