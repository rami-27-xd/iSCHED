"use client"

import { useState } from "react"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  BookOpen, Plus, Search, Clock, MoreHorizontal, Pencil, Trash2,
} from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const TYPE_COLORS: Record<string, string> = {
  LECTURE: "bg-primary/10 text-primary",
  LABORATORY: "bg-accent/10 text-accent-foreground",
  HYBRID: "bg-info/10 text-info",
}

const subjectsData = [
  { id: "1", code: "IT 101", title: "Introduction to Computing", units: 3, hoursPerWeek: 3, type: "LECTURE", department: "CCS", requiredRoomType: "LECTURE_ROOM" },
  { id: "2", code: "IT 102", title: "Computer Programming 1", units: 3, hoursPerWeek: 3, type: "LABORATORY", department: "CCS", requiredRoomType: "COMPUTER_LAB" },
  { id: "3", code: "IT 201", title: "Data Structures & Algorithms", units: 3, hoursPerWeek: 3, type: "LECTURE", department: "CCS", requiredRoomType: "LECTURE_ROOM" },
  { id: "4", code: "IT 202", title: "Object-Oriented Programming", units: 3, hoursPerWeek: 3, type: "LABORATORY", department: "CCS", requiredRoomType: "COMPUTER_LAB" },
  { id: "5", code: "IT 301", title: "Web Development", units: 3, hoursPerWeek: 3, type: "HYBRID", department: "CCS", requiredRoomType: "LECTURE_LAB" },
  { id: "6", code: "GE 101", title: "Understanding the Self", units: 3, hoursPerWeek: 3, type: "LECTURE", department: "CAS", requiredRoomType: "LECTURE_ROOM" },
  { id: "7", code: "ED 101", title: "Foundations of Education", units: 3, hoursPerWeek: 3, type: "LECTURE", department: "COED", requiredRoomType: "LECTURE_ROOM" },
]

export default function SubjectsPage() {
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [addOpen, setAddOpen] = useState(false)

  const filtered = subjectsData.filter((s) => {
    const matchSearch =
      s.code.toLowerCase().includes(search.toLowerCase()) ||
      s.title.toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === "all" || s.type === typeFilter
    return matchSearch && matchType
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subjects"
        description="Manage course offerings and subject configurations"
        action={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger render={<Button />}>
              <Plus className="mr-2 h-4 w-4" />Add Subject
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Add Subject</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Subject Code</Label>
                    <Input placeholder="e.g. IT 101" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Units</Label>
                    <Input type="number" defaultValue={3} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Title</Label>
                  <Input placeholder="e.g. Introduction to Computing" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Type</Label>
                    <Select>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LECTURE">Lecture</SelectItem>
                        <SelectItem value="LABORATORY">Laboratory</SelectItem>
                        <SelectItem value="HYBRID">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Hours/Week</Label>
                    <Input type="number" defaultValue={3} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Department</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CCS">CCS</SelectItem>
                      <SelectItem value="COED">COED</SelectItem>
                      <SelectItem value="CAS">CAS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button onClick={() => setAddOpen(false)}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search subjects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={(v) => v && setTypeFilter(v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="LECTURE">Lecture</SelectItem>
            <SelectItem value="LABORATORY">Laboratory</SelectItem>
            <SelectItem value="HYBRID">Hybrid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={BookOpen} title="No subjects found" description="No subjects match your search." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Units</TableHead>
                  <TableHead>Hours/Week</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono font-medium">{s.code}</TableCell>
                    <TableCell>{s.title}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={TYPE_COLORS[s.type] ?? ""}>{s.type}</Badge>
                    </TableCell>
                    <TableCell>{s.units}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />{s.hoursPerWeek}h
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{s.department}</Badge></TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
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
