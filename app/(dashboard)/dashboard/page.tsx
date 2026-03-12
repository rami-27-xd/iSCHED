"use client"

import { PageHeader } from "@/components/shared/page-header"
import { KPICard } from "@/components/shared/kpi-card"
import {
  CalendarDays,
  Users,
  DoorOpen,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  Clock,
  BookOpen,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const kpiData = [
  {
    title: "Active Schedules",
    value: "3",
    change: { value: 12, label: "from last sem" },
    icon: CalendarDays,
    variant: "default" as const,
  },
  {
    title: "Total Faculty",
    value: "47",
    change: { value: 5, label: "new this sem" },
    icon: Users,
    variant: "accent" as const,
  },
  {
    title: "Rooms Available",
    value: "24",
    icon: DoorOpen,
    variant: "default" as const,
  },
  {
    title: "Conflicts Detected",
    value: "2",
    change: { value: -67, label: "from last gen" },
    icon: AlertTriangle,
    variant: "error" as const,
  },
]

const recentActivity = [
  {
    icon: CheckCircle2,
    label: "CCS schedule published",
    time: "2 hours ago",
    color: "text-success",
  },
  {
    icon: AlertTriangle,
    label: "Faculty overlap detected in BSIT 3-A",
    time: "4 hours ago",
    color: "text-destructive",
  },
  {
    icon: Clock,
    label: "COED schedule generation started",
    time: "5 hours ago",
    color: "text-accent",
  },
  {
    icon: Users,
    label: "3 new faculty members added",
    time: "1 day ago",
    color: "text-primary",
  },
  {
    icon: BookOpen,
    label: "12 subjects updated for 1st Sem",
    time: "2 days ago",
    color: "text-primary",
  },
]

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of the scheduling system"
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiData.map((kpi) => (
          <KPICard
            key={kpi.title}
            title={kpi.title}
            value={kpi.value}
            change={kpi.change}
            icon={kpi.icon}
            variant={kpi.variant}
          />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className={`mt-0.5 ${item.color}`}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {item.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <QuickActionButton
                href="/dashboard/schedules"
                icon={CalendarDays}
                label="Generate Schedule"
                description="Auto-assign classes"
              />
              <QuickActionButton
                href="/dashboard/faculty"
                icon={Users}
                label="Manage Faculty"
                description="View & edit faculty"
              />
              <QuickActionButton
                href="/dashboard/rooms"
                icon={DoorOpen}
                label="Room Management"
                description="Configure rooms"
              />
              <QuickActionButton
                href="/dashboard/analytics"
                icon={TrendingUp}
                label="View Analytics"
                description="Utilization reports"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function QuickActionButton({
  href,
  icon: Icon,
  label,
  description,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  description: string
}) {
  return (
    <a
      href={href}
      className="group flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-secondary"
    >
      <div className="rounded-md bg-primary/10 p-2 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </a>
  )
}
