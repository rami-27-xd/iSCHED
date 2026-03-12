import * as React from 'react'
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
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Activity,
  FileText,
  Building2,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'

// ---------------------------------------------------------------------------
// Icon lookup
// ---------------------------------------------------------------------------

const iconMap: Record<string, LucideIcon> = {
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
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Activity,
  FileText,
  Building2,
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type KpiCardVariant = 'default' | 'accent' | 'success' | 'error'

export interface KpiCardProps {
  /** Title label (e.g. "Total Faculty") */
  title: string
  /** Display value (e.g. "128") */
  value: string | number
  /** Lucide icon name from the lookup map */
  icon: string
  /** Visual variant controls the icon badge background */
  variant?: KpiCardVariant
  /** Optional change text (e.g. "+12% from last month") */
  change?: string
  /** Whether the change is positive, negative, or neutral */
  changeType?: 'positive' | 'negative' | 'neutral'
  className?: string
}

// ---------------------------------------------------------------------------
// Variant styles
// ---------------------------------------------------------------------------

const iconBadgeVariants: Record<KpiCardVariant, string> = {
  default: 'bg-primary/10 text-primary',
  accent: 'bg-accent/15 text-accent-foreground',
  success: 'bg-success/10 text-success',
  error: 'bg-destructive/10 text-destructive',
}

const changeStyles: Record<string, string> = {
  positive: 'text-success',
  negative: 'text-destructive',
  neutral: 'text-muted-foreground',
}

// ---------------------------------------------------------------------------
// KpiCard
// ---------------------------------------------------------------------------

export function KpiCard({
  title,
  value,
  icon,
  variant = 'default',
  change,
  changeType = 'neutral',
  className,
}: KpiCardProps) {
  const Icon = iconMap[icon] ?? Activity

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardContent className="flex items-start gap-4">
        {/* Icon badge */}
        <div
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-lg',
            iconBadgeVariants[variant]
          )}
        >
          <Icon className="size-5" />
        </div>

        {/* Text content */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-xs font-medium text-muted-foreground">
            {title}
          </span>
          <span className="text-2xl font-bold tracking-tight text-card-foreground">
            {value}
          </span>
          {change && (
            <span className={cn('text-xs font-medium', changeStyles[changeType])}>
              {changeType === 'positive' && (
                <TrendingUp className="mr-1 inline size-3" />
              )}
              {changeType === 'negative' && (
                <TrendingDown className="mr-1 inline size-3" />
              )}
              {change}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
