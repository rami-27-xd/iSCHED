"use client"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Settings, GraduationCap, Clock, CalendarDays, Bell, Shield,
} from "lucide-react"

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="System configuration and preferences" />

      <div className="grid gap-6 max-w-2xl">
        {/* Academic Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
              Academic Settings
            </CardTitle>
            <CardDescription>Configure academic year and semester</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Current Academic Year</Label>
                <Select defaultValue="2025-2026">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2025-2026">2025-2026</SelectItem>
                    <SelectItem value="2026-2027">2026-2027</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Active Semester</Label>
                <Select defaultValue="FIRST">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIRST">1st Semester</SelectItem>
                    <SelectItem value="SECOND">2nd Semester</SelectItem>
                    <SelectItem value="SUMMER">Summer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scheduling Defaults */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Scheduling Defaults
            </CardTitle>
            <CardDescription>Default constraints for schedule generation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Max Daily Hours (Faculty)</Label>
                <Input type="number" defaultValue={8} />
              </div>
              <div className="grid gap-2">
                <Label>Max Weekly Units</Label>
                <Input type="number" defaultValue={21} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Schedule Start Time</Label>
                <Input type="time" defaultValue="07:00" />
              </div>
              <div className="grid gap-2">
                <Label>Schedule End Time</Label>
                <Input type="time" defaultValue="20:00" />
              </div>
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Prefer Morning Slots</p>
                  <p className="text-xs text-muted-foreground">Prioritize earlier time slots when generating</p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">No Back-to-Back Labs</p>
                  <p className="text-xs text-muted-foreground">Prevent consecutive lab sessions for faculty</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Include Saturdays</p>
                  <p className="text-xs text-muted-foreground">Allow scheduling on Saturdays</p>
                </div>
                <Switch />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4 text-muted-foreground" />
              Notifications
            </CardTitle>
            <CardDescription>Configure notification preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Conflict Alerts</p>
                <p className="text-xs text-muted-foreground">Notify when conflicts are detected</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Schedule Published</p>
                <p className="text-xs text-muted-foreground">Notify when a schedule is published</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Faculty Availability Changes</p>
                <p className="text-xs text-muted-foreground">Notify when faculty update availability</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button>Save Settings</Button>
        </div>
      </div>
    </div>
  )
}
