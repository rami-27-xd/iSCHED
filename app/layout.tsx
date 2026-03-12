import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "sonner"
import { QueryProvider } from "@/components/providers/query-provider"
import "./globals.css"

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "iSched — Scheduling Management System",
  description:
    "Web-Based Scheduling Management System with Constraint-Based Assignment — SLSU Lucban Campus",
  icons: { icon: "/favicon.ico" },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={`${inter.variable} antialiased`}>
          <QueryProvider>
            <TooltipProvider>
              {children}
              <Toaster
                position="top-right"
                richColors
                closeButton
                toastOptions={{
                  className: "font-sans",
                }}
              />
            </TooltipProvider>
          </QueryProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
