"use client"

import { useState } from "react"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DoorOpen,
  Plus,
  Search,
  Building2,
  Users,
  Monitor,
  MoreHorizontal,
  CalendarDays,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const ROOM_TYPE_LABELS: Record<string, string> = {
  LECTURE_ROOM: "Lecture Room",
  LABORATORY: "Laboratory",
  COMPUTER_LAB: "Computer Lab",
  LECTURE_LAB: "Lecture/Lab",
}

const ROOM_TYPE_COLORS: Record<string, string> = {
  LECTURE_ROOM: "bg-primary/10 text-primary",
  LABORATORY: "bg-accent/10 text-accent-foreground",
  COMPUTER_LAB: "bg-info/10 text-info",
  LECTURE_LAB: "bg-success/10 text-success",
}

const roomsData = [
  {
    id: "1",
    name: "Room 101",
    code: "CCS-101",
    building: "CCS Building",
    type: "LECTURE_ROOM",
    capacity: 40,
    equipment: ["Projector", "Whiteboard", "AC"],
    isActive: true,
    utilization: 85,
  },
  {
    id: "2",
    name: "Lab 201",
    code: "CCS-LAB-201",
    building: "CCS Building",
    type: "COMPUTER_LAB",
    capacity: 35,
    equipment: ["Computers", "Projector", "AC"],
    isActive: true,
    utilization: 92,
  },
  {
    id: "3",
    name: "Room 102",
    code: "CCS-102",
    building: "CCS Building",
    type: "LECTURE_ROOM",
    capacity: 45,
    equipment: ["Projector", "Whiteboard"],
    isActive: true,
    utilization: 60,
  },
  {
    id: "4",
    name: "Lab 301",
    code: "CCS-LAB-301",
    building: "CCS Building",
    type: "LABORATORY",
    capacity: 30,
    equipment: ["Lab Equipment", "Projector"],
    isActive: true,
    utilization: 45,
  },
  {
    id: "5",
    name: "Room 201",
    code: "COED-201",
    building: "COED Building",
    type: "LECTURE_ROOM",
    capacity: 50,
    equipment: ["Projector", "Whiteboard", "AC"],
    isActive: false,
    utilization: 0,
  },
]

export default function RoomsPage() {
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [addOpen, setAddOpen] = useState(false)

  const filtered = roomsData.filter((r) => {
    const matchSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.code.toLowerCase().includes(search.toLowerCase()) ||
      r.building.toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === "all" || r.type === typeFilter
    return matchSearch && matchType
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rooms"
        description="Manage rooms, labs, and their configurations"
        action={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger render={<Button />}>
                <Plus className="mr-2 h-4 w-4" />
                Add Room
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Room</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="rname">Room Name</Label>
                    <Input id="rname" placeholder="e.g. Room 101" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="rcode">Room Code</Label>
                    <Input id="rcode" placeholder="e.g. CCS-101" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Building</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select building" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CCS">CCS Building</SelectItem>
                      <SelectItem value="COED">COED Building</SelectItem>
                      <SelectItem value="CAS">CAS Building</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Room Type</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LECTURE_ROOM">Lecture Room</SelectItem>
                        <SelectItem value="LABORATORY">Laboratory</SelectItem>
                        <SelectItem value="COMPUTER_LAB">Computer Lab</SelectItem>
                        <SelectItem value="LECTURE_LAB">Lecture/Lab</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="rcap">Capacity</Label>
                    <Input id="rcap" type="number" placeholder="40" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setAddOpen(false)}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search rooms..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => v && setTypeFilter(v)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="LECTURE_ROOM">Lecture Room</SelectItem>
            <SelectItem value="LABORATORY">Laboratory</SelectItem>
            <SelectItem value="COMPUTER_LAB">Computer Lab</SelectItem>
            <SelectItem value="LECTURE_LAB">Lecture/Lab</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={DoorOpen}
          title="No rooms found"
          description="No rooms match your search criteria."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Room</TableHead>
                  <TableHead>Building</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Equipment</TableHead>
                  <TableHead>Utilization</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roomsData
                  .filter((r) => {
                    const matchSearch =
                      r.name.toLowerCase().includes(search.toLowerCase()) ||
                      r.code.toLowerCase().includes(search.toLowerCase())
                    const matchType = typeFilter === "all" || r.type === typeFilter
                    return matchSearch && matchType
                  })
                  .map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{r.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {r.code}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          {r.building}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={ROOM_TYPE_COLORS[r.type] ?? ""}
                        >
                          {ROOM_TYPE_LABELS[r.type] ?? r.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          {r.capacity}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {r.equipment.slice(0, 2).map((e) => (
                            <Badge key={e} variant="outline" className="text-xs">
                              {e}
                            </Badge>
                          ))}
                          {r.equipment.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{r.equipment.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                r.utilization >= 80
                                  ? "bg-primary"
                                  : r.utilization >= 50
                                  ? "bg-success"
                                  : "bg-muted-foreground/40"
                              }`}
                              style={{ width: `${r.utilization}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {r.utilization}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.isActive ? "default" : "secondary"}>
                          {r.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
                              <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <CalendarDays className="mr-2 h-4 w-4" /> View Schedule
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Monitor className="mr-2 h-4 w-4" /> Edit Room
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
