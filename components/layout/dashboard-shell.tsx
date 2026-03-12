'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { Menu, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from '@/components/ui/sheet'
import { Sidebar, type SidebarProps } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardShellProps {
  children: React.ReactNode
  /** Page title displayed in the topbar */
  title: string
  userRole: string
  userName?: string
  userEmail?: string
}

// ---------------------------------------------------------------------------
// DashboardShell
// ---------------------------------------------------------------------------

export function DashboardShell({
  children,
  title,
  userRole,
  userName,
  userEmail,
}: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const pathname = usePathname()

  // Close mobile sidebar on route change
  React.useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const sidebarProps: SidebarProps = { userRole, userName, userEmail }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col bg-sidebar">
        <Sidebar {...sidebarProps} />
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          title={title}
          userName={userName}
          userEmail={userEmail}
          leading={
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    aria-label="Open navigation"
                  />
                }
              >
                <Menu className="size-5" />
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-64 p-0 bg-sidebar border-sidebar-border"
              >
                <SheetTitle className="sr-only">Navigation menu</SheetTitle>
                <Sidebar {...sidebarProps} />
              </SheetContent>
            </Sheet>
          }
        />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
