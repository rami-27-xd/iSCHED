import type { Metadata } from "next"
import { Poppins } from "next/font/google"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "sonner"
import { QueryProvider } from "@/components/providers/query-provider"
import "./globals.css"

const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700"],
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
    <html lang="en" suppressHydrationWarning>
      <body className={`${poppins.variable} antialiased`}>
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
  )
}
