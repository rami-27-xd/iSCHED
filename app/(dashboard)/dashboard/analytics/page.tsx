"use client"

import { PageHeader } from "@/components/shared/page-header"
import { KPICard } from "@/components/shared/kpi-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  BarChart3,
  DoorOpen,
  Users,
  CalendarDays,
  AlertTriangle,
  TrendingUp,
  Clock,
  BookOpen,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts"

const roomUtilization = [
  { room: "CCS-101", utilization: 85 },
  { room: "LAB-201", utilization: 92 },
  { room: "CCS-102", utilization: 60 },
  { room: "LAB-301", utilization: 45 },
  { room: "COED-201", utilization: 72 },
  { room: "CCS-103", utilization: 55 },
  { room: "LAB-202", utilization: 88 },
]

const facultyLoad = [
  { name: "Dr. Santos", current: 18, max: 21 },
  { name: "Prof. Dela Cruz", current: 21, max: 21 },
  { name: "Dr. Reyes", current: 15, max: 18 },
  { name: "Prof. Garcia", current: 12, max: 21 },
  { name: "Dr. Lim", current: 18, max: 21 },
  { name: "Prof. Cruz", current: 9, max: 21 },
]

const subjectDistribution = [
  { name: "Lecture", value: 45, color: "#1B4332" },
  { name: "Laboratory", value: 30, color: "#2D6A4F" },
  { name: "Hybrid", value: 15, color: "#40916C" },
]

const weeklyTrend = [
  { day: "Mon", classes: 24, conflicts: 1 },
  { day: "Tue", classes: 22, conflicts: 0 },
  { day: "Wed", classes: 20, conflicts: 2 },
  { day: "Thu", classes: 23, conflicts: 0 },
  { day: "Fri", classes: 18, conflicts: 1 },
]

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Schedule utilization and performance insights"
        action={
          <Select defaultValue="1st-2025">
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1st-2025">1st Semester 2025-2026</SelectItem>
              <SelectItem value="2nd-2025">2nd Semester 2025-2026</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {/* KPI Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Avg Room Utilization"
          value="71%"
          change={{ value: 8, label: "vs last sem" }}
          icon={DoorOpen}
          variant="default"
        />
        <KPICard
          title="Faculty Load Balance"
          value="78%"
          change={{ value: 5, label: "improvement" }}
          icon={Users}
          variant="accent"
        />
        <KPICard
          title="Schedule Coverage"
          value="94%"
          change={{ value: 3, label: "vs last sem" }}
          icon={CalendarDays}
          variant="default"
        />
        <KPICard
          title="Conflict Rate"
          value="2.1%"
          change={{ value: -45, label: "reduction" }}
          icon={AlertTriangle}
          variant="error"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Room Utilization */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DoorOpen className="h-4 w-4 text-muted-foreground" />
              Room Utilization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={roomUtilization} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="room" tick={{ fontSize: 11, fill: "#64748B" }} />
                <YAxis
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  domain={[0, 100]}
                />
                <Tooltip
                  formatter={(value) => [`${value}%`, "Utilization"]}
                  contentStyle={{
                    background: "#fff",
                    border: "1px solid #E2E8F0",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="utilization" radius={[4, 4, 0, 0]}>
                  {roomUtilization.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={
                        entry.utilization >= 80
                          ? "#1B4332"
                          : entry.utilization >= 50
                          ? "#52B788"
                          : "#CBD5E1"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Faculty Load */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-muted-foreground" />
              Faculty Teaching Load
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={facultyLoad}
                layout="vertical"
                margin={{ top: 4, right: 16, bottom: 4, left: 70 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 24]}
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  tickFormatter={(v) => `${v}u`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  width={65}
                />
                <Tooltip
                  contentStyle={{
                    background: "#fff",
                    border: "1px solid #E2E8F0",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="current" name="Current" fill="#1B4332" radius={[0, 4, 4, 0]} barSize={14} />
                <Bar dataKey="max" name="Max" fill="#E2E8F0" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Subject Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              Subject Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={subjectDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {subjectDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#fff",
                    border: "1px solid #E2E8F0",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Weekly Trend */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Weekly Class Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={weeklyTrend} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#64748B" }} />
                <YAxis tick={{ fontSize: 12, fill: "#64748B" }} />
                <Tooltip
                  contentStyle={{
                    background: "#fff",
                    border: "1px solid #E2E8F0",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="classes"
                  name="Classes"
                  stroke="#1B4332"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#1B4332" }}
                />
                <Line
                  type="monotone"
                  dataKey="conflicts"
                  name="Conflicts"
                  stroke="#DC2626"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#DC2626" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
