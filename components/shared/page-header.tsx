import * as React from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PageHeaderProps {
  /** Page title */
  title: string
  /** Optional description shown below the title */
  description?: string
  /** Optional right-side action area (buttons, filters, etc.) */
  children?: React.ReactNode
}

// ---------------------------------------------------------------------------
// PageHeader
// ---------------------------------------------------------------------------

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {children && (
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      )}
    </div>
  )
}
