import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Navbar } from "@/components/layout/Navbar"
import { MobileNav } from "@/components/layout/MobileNav"
import { AddTransactionModal } from "@/components/transactions/AddTransactionModal"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Stockify — PSX Portfolio Manager",
  description: "Track, manage, and analyze your Pakistan Stock Exchange portfolio with real-time data, smart analytics, and a beautiful dark interface.",
  keywords: ["PSX", "Pakistan Stock Exchange", "portfolio manager", "stocks", "trading"],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full dark`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground antialiased">
        <Navbar />
        <MobileNav />
        <main className="flex-1">
          {children}
        </main>
        <AddTransactionModal />

        {/* Footer */}
        <footer className="border-t border-zinc-800/50 py-6 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
              <p className="text-xs text-zinc-600">
                © {new Date().getFullYear()} Stockify. For educational purposes only.
              </p>
              <p className="text-xs text-zinc-700">
                Data sourced from PSX. Not financial advice.
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
