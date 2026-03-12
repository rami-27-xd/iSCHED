'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  DoorOpen,
  BookOpen,
  GraduationCap,
  BarChart3,
  QrCode,
  UserCog,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UserRole =
  | 'SUPER_ADMIN'
  | 'DEPARTMENT_CHAIR'
  | 'PROGRAM_HEAD'
  | 'FACULTY'
  | 'STUDENT'

interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  roles: UserRole[]
}

export interface SidebarProps {
  userRole: string
  userName?: string
  userEmail?: string
}

// ---------------------------------------------------------------------------
// Navigation items
// ---------------------------------------------------------------------------

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['SUPER_ADMIN', 'DEPARTMENT_CHAIR', 'PROGRAM_HEAD', 'FACULTY', 'STUDENT'],
  },
  {
    title: 'Schedules',
    href: '/dashboard/schedules',
    icon: CalendarDays,
    roles: ['SUPER_ADMIN', 'DEPARTMENT_CHAIR', 'PROGRAM_HEAD', 'FACULTY', 'STUDENT'],
  },
  {
    title: 'Faculty',
    href: '/dashboard/faculty',
    icon: Users,
    roles: ['SUPER_ADMIN', 'DEPARTMENT_CHAIR', 'PROGRAM_HEAD'],
  },
  {
    title: 'Rooms',
    href: '/dashboard/rooms',
    icon: DoorOpen,
    roles: ['SUPER_ADMIN', 'DEPARTMENT_CHAIR', 'PROGRAM_HEAD'],
  },
  {
    title: 'Subjects',
    href: '/dashboard/subjects',
    icon: BookOpen,
    roles: ['SUPER_ADMIN', 'DEPARTMENT_CHAIR', 'PROGRAM_HEAD'],
  },
  {
    title: 'Sections',
    href: '/dashboard/sections',
    icon: GraduationCap,
    roles: ['SUPER_ADMIN', 'DEPARTMENT_CHAIR', 'PROGRAM_HEAD'],
  },
  {
    title: 'Analytics',
    href: '/dashboard/analytics',
    icon: BarChart3,
    roles: ['SUPER_ADMIN', 'DEPARTMENT_CHAIR'],
  },
  {
    title: 'QR Codes',
    href: '/dashboard/qr-codes',
    icon: QrCode,
    roles: ['SUPER_ADMIN', 'DEPARTMENT_CHAIR'],
  },
  {
    title: 'Users',
    href: '/dashboard/users',
    icon: UserCog,
    roles: ['SUPER_ADMIN'],
  },
  {
    title: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
    roles: ['SUPER_ADMIN'],
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFilteredNavItems(role: string): NavItem[] {
  return navItems.filter((item) => item.roles.includes(role as UserRole))
}

function getInitials(name?: string): string {
  if (!name) return 'U'
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function formatRole(role: string): string {
  return role
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ')
}

// ---------------------------------------------------------------------------
// NavLink
// ---------------------------------------------------------------------------

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span>{item.title}</span>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export function Sidebar({ userRole, userName, userEmail }: SidebarProps) {
  const pathname = usePathname()
  const filtered = getFilteredNavItems(userRole)

  return (
    <div className="flex h-full flex-col">
      {/* Logo area */}
      <div className="flex h-16 items-center gap-3 px-4">
        <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary">
          <CalendarDays className="size-5 text-sidebar-primary-foreground" />
        </div>
        <div className="flex flex-col">
          <span className="text-base font-bold tracking-tight text-sidebar-foreground">
            iSched
          </span>
          <span className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50">
            SLSU Scheduling
          </span>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Navigation links */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="flex flex-col gap-1">
          {filtered.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href))

            return <NavLink key={item.href} item={item} isActive={isActive} />
          })}
        </nav>
      </ScrollArea>

      <Separator className="bg-sidebar-border" />

      {/* User profile section */}
      <div className="flex items-center gap-3 px-3 py-3">
        <Avatar size="default">
          <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
            {getInitials(userName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium text-sidebar-foreground">
            {userName ?? 'User'}
          </span>
          {userEmail && (
            <span className="truncate text-xs text-sidebar-foreground/60">
              {userEmail}
            </span>
          )}
          <Badge
            variant="secondary"
            className="mt-1 w-fit bg-sidebar-primary/20 text-sidebar-primary text-[10px]"
          >
            {formatRole(userRole)}
          </Badge>
        </div>
      </div>
    </div>
  )
}
