import * as React from 'react'
import {
  Inbox,
  Search,
  FileX2,
  CalendarX2,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Icon lookup
// ---------------------------------------------------------------------------

const iconMap: Record<string, LucideIcon> = {
  Inbox,
  Search,
  FileX2,
  CalendarX2,
  Users,
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmptyStateProps {
  /** Lucide icon name from the lookup map */
  icon?: string
  /** Heading text */
  title: string
  /** Supporting description */
  description?: string
  /** Optional call-to-action (e.g. a Button) */
  children?: React.ReactNode
  className?: string
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

export function EmptyState({
  icon = 'Inbox',
  title,
  description,
  children,
  className,
}: EmptyStateProps) {
  const Icon = iconMap[icon] ?? Inbox

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 py-16 text-center',
        className
      )}
    >
      <div className="flex size-16 items-center justify-center rounded-full bg-muted">
        <Icon className="size-7 text-muted-foreground" />
      </div>

      <div className="flex max-w-sm flex-col gap-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {children && <div className="mt-2">{children}</div>}
    </div>
  )
}
