'use client'

import * as React from 'react'
import { Bell, LogOut, User, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TopbarProps {
  title: string
  /** Slot rendered to the left of the title (e.g. mobile sidebar trigger) */
  leading?: React.ReactNode
  userName?: string
  userEmail?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name?: string): string {
  if (!name) return 'U'
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// ---------------------------------------------------------------------------
// Topbar
// ---------------------------------------------------------------------------

export function Topbar({ title, leading, userName, userEmail }: TopbarProps) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-card px-4 lg:px-6">
      {/* Mobile sidebar trigger slot */}
      {leading}

      {/* Page title */}
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>

      {/* Right-side actions */}
      <div className="ml-auto flex items-center gap-2">
        {/* Notification bell */}
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="size-4" />
          {/* Notification dot indicator */}
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-accent" />
        </Button>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label="User menu"
              />
            }
          >
            <Avatar size="sm">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {getInitials(userName)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" sideOffset={8} className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">
                  {userName ?? 'User'}
                </span>
                {userEmail && (
                  <span className="text-xs text-muted-foreground">{userEmail}</span>
                )}
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem>
                <User className="size-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="size-4" />
                <span>Settings</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuItem variant="destructive">
              <LogOut className="size-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
