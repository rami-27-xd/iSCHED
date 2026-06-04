'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from '@/components/ui/sheet'
import { Sidebar, type SidebarProps } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'

// ── User role context ─────────────────────────────────────────────────────
const UserRoleContext = React.createContext<string>("FACULTY")
export function useUserRole() { return React.useContext(UserRoleContext) }

export interface DashboardShellProps {
  children: React.ReactNode
  userRole: string
  userName?: string
  userEmail?: string
}

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/schedules': 'Manage Schedules',
  '/dashboard/availability': 'Faculty Availability',
  '/dashboard/faculty': 'Faculty',
  '/dashboard/rooms': 'Buildings',
  '/dashboard/subjects': 'Departments',
  '/dashboard/my-schedule': 'My Schedule',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/users': 'Users',
  '/dashboard/settings': 'Settings',
}

export function DashboardShell({ children, userRole, userName, userEmail }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [collapsed, setCollapsed] = React.useState(false)
  const pathname = usePathname()
  const title = PAGE_TITLES[pathname] ?? 'iSched'

  React.useEffect(() => { setMobileOpen(false) }, [pathname])

  const sidebarProps: SidebarProps = { userRole, userName, userEmail }

  return (
    <UserRoleContext.Provider value={userRole}>
      <div className="flex h-screen overflow-hidden bg-background">

        {/* Desktop sidebar — collapsible */}
        <aside
          className={`hidden lg:flex lg:shrink-0 lg:flex-col bg-sidebar transition-all duration-200 ${
            collapsed ? 'lg:w-16' : 'lg:w-64'
          }`}
        >
          <Sidebar
            {...sidebarProps}
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed(v => !v)}
          />
        </aside>

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
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
                <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border">
                  <SheetTitle className="sr-only">Navigation menu</SheetTitle>
                  <Sidebar {...sidebarProps} />
                </SheetContent>
              </Sheet>
            }
          />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </UserRoleContext.Provider>
  )
}
