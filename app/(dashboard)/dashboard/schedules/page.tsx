"use client"

import { useState } from "react"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { ScheduleCalendar } from "@/components/schedule/schedule-calendar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  CalendarDays,
  Play,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Send,
  Filter,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Demo schedule entries
const demoEntries = [
  {
    id: "1",
    subjectCode: "IT 101",
    subjectTitle: "Intro to Computing",
    facultyName: "Dr. Santos",
    roomCode: "CCS-101",
    sectionName: "BSIT 1-A",
    day: "MONDAY",
    startTime: "07:00",
    endTime: "08:30",
    type: "LECTURE" as const,
  },
  {
    id: "2",
    subjectCode: "IT 102",
    subjectTitle: "Computer Programming 1",
    facultyName: "Prof. Dela Cruz",
    roomCode: "CCS-LAB-201",
    sectionName: "BSIT 1-A",
    day: "MONDAY",
    startTime: "09:00",
    endTime: "12:00",
    type: "LABORATORY" as const,
  },
  {
    id: "3",
    subjectCode: "IT 201",
    subjectTitle: "Data Structures",
    facultyName: "Dr. Santos",
    roomCode: "CCS-101",
    sectionName: "BSIT 2-A",
    day: "TUESDAY",
    startTime: "08:00",
    endTime: "09:30",
    type: "LECTURE" as const,
  },
  {
    id: "4",
    subjectCode: "IT 202",
    subjectTitle: "OOP",
    facultyName: "Prof. Dela Cruz",
    roomCode: "CCS-LAB-201",
    sectionName: "BSIT 2-A",
    day: "TUESDAY",
    startTime: "10:00",
    endTime: "13:00",
    type: "LABORATORY" as const,
  },
  {
    id: "5",
    subjectCode: "IT 301",
    subjectTitle: "Web Development",
    facultyName: "Dr. Reyes",
    roomCode: "CCS-102",
    sectionName: "BSIT 3-A",
    day: "WEDNESDAY",
    startTime: "08:00",
    endTime: "10:00",
    type: "HYBRID" as const,
  },
  {
    id: "6",
    subjectCode: "GE 101",
    subjectTitle: "Understanding the Self",
    facultyName: "Prof. Garcia",
    roomCode: "CCS-101",
    sectionName: "BSIT 1-A",
    day: "WEDNESDAY",
    startTime: "13:00",
    endTime: "14:30",
    type: "LECTURE" as const,
  },
  {
    id: "7",
    subjectCode: "IT 101",
    subjectTitle: "Intro to Computing",
    facultyName: "Dr. Santos",
    roomCode: "CCS-101",
    sectionName: "BSIT 1-B",
    day: "THURSDAY",
    startTime: "07:00",
    endTime: "08:30",
    type: "LECTURE" as const,
  },
  {
    id: "8",
    subjectCode: "IT 201",
    subjectTitle: "Data Structures",
    facultyName: "Dr. Santos",
    roomCode: "CCS-102",
    sectionName: "BSIT 2-A",
    day: "FRIDAY",
    startTime: "09:00",
    endTime: "10:30",
    type: "LECTURE" as const,
    hasConflict: true,
  },
]

export default function SchedulesPage() {
  const [semester, setSemester] = useState("1st-2025")
  const [view, setView] = useState("calendar")
  const [generateOpen, setGenerateOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null)

  const conflictCount = demoEntries.filter((e) => e.hasConflict).length

  const handleGenerate = () => {
    setIsGenerating(true)
    setTimeout(() => {
      setIsGenerating(false)
      setGenerateOpen(false)
    }, 3000)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedules"
        description="Generate, manage, and publish class schedules"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button onClick={() => setGenerateOpen(true)}>
              <Play className="mr-2 h-4 w-4" />
              Generate Schedule
            </Button>
          </div>
        }
      />

      {/* Status Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={semester} onValueChange={(v) => v && setSemester(v)}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1st-2025">1st Semester 2025-2026</SelectItem>
            <SelectItem value="2nd-2025">2nd Semester 2025-2026</SelectItem>
            <SelectItem value="summer-2026">Summer 2026</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-success" />
            {demoEntries.length - conflictCount} entries
          </Badge>
          {conflictCount > 0 && (
            <Badge variant="destructive" className="gap-1.5">
              <AlertTriangle className="h-3 w-3" />
              {conflictCount} conflict{conflictCount !== 1 ? "s" : ""}
            </Badge>
          )}
          <Badge variant="secondary" className="gap-1.5">
            <Clock className="h-3 w-3" />
            Draft
          </Badge>
        </div>

        <div className="ml-auto">
          <Button variant="outline" size="sm">
            <Send className="mr-2 h-4 w-4" />
            Publish
          </Button>
        </div>
      </div>

      {/* Calendar View */}
      <Tabs value={view} onValueChange={(v) => v && setView(v)}>
        <TabsList>
          <TabsTrigger value="calendar">
            <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="list">
            <Filter className="mr-1.5 h-3.5 w-3.5" />
            List View
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-4">
          <ScheduleCalendar
            entries={demoEntries}
            editable
            onEntryClick={(id) => setSelectedEntry(id)}
            onEntryDrop={(id, day, start, end) => {
              console.log("Moved:", { id, day, start, end })
            }}
          />
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {demoEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors ${
                      entry.hasConflict ? "bg-destructive/5" : ""
                    }`}
                  >
                    <div
                      className="w-1 self-stretch rounded-full"
                      style={{
                        backgroundColor: entry.hasConflict
                          ? "#DC2626"
                          : entry.type === "LECTURE"
                          ? "#1B4332"
                          : entry.type === "LABORATORY"
                          ? "#2D6A4F"
                          : "#40916C",
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{entry.subjectCode}</span>
                        <span className="text-xs text-muted-foreground">{entry.subjectTitle}</span>
                        {entry.hasConflict && (
                          <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        <span>{entry.facultyName}</span>
                        <span>{entry.roomCode}</span>
                        <span>{entry.sectionName}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{entry.day.charAt(0) + entry.day.slice(1).toLowerCase()}</p>
                      <p className="text-xs text-muted-foreground">{entry.startTime} - {entry.endTime}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Generate Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Schedule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              The scheduling engine will use a constraint-based backtracking algorithm to automatically
              assign classes to time slots, rooms, and faculty while respecting all constraints.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-3">
                <p className="text-xs text-muted-foreground">Subjects</p>
                <p className="text-lg font-bold">7</p>
              </Card>
              <Card className="p-3">
                <p className="text-xs text-muted-foreground">Faculty</p>
                <p className="text-lg font-bold">4</p>
              </Card>
              <Card className="p-3">
                <p className="text-xs text-muted-foreground">Rooms</p>
                <p className="text-lg font-bold">5</p>
              </Card>
              <Card className="p-3">
                <p className="text-xs text-muted-foreground">Sections</p>
                <p className="text-lg font-bold">8</p>
              </Card>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)} disabled={isGenerating}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Generate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
