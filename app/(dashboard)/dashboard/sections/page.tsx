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
  GraduationCap, Plus, Search, Users, MoreHorizontal, Pencil, CalendarDays,
} from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const sectionsData = [
  { id: "1", name: "BSIT 1-A", program: "BSIT", yearLevel: 1, capacity: 40, department: "CCS", studentCount: 38 },
  { id: "2", name: "BSIT 1-B", program: "BSIT", yearLevel: 1, capacity: 40, department: "CCS", studentCount: 35 },
  { id: "3", name: "BSIT 2-A", program: "BSIT", yearLevel: 2, capacity: 40, department: "CCS", studentCount: 42 },
  { id: "4", name: "BSIT 3-A", program: "BSIT", yearLevel: 3, capacity: 40, department: "CCS", studentCount: 36 },
  { id: "5", name: "BSIT 4-A", program: "BSIT", yearLevel: 4, capacity: 40, department: "CCS", studentCount: 33 },
  { id: "6", name: "BSCS 1-A", program: "BSCS", yearLevel: 1, capacity: 35, department: "CCS", studentCount: 30 },
  { id: "7", name: "BSED 1-A", program: "BSED", yearLevel: 1, capacity: 45, department: "COED", studentCount: 40 },
  { id: "8", name: "BSED 2-A", program: "BSED", yearLevel: 2, capacity: 45, department: "COED", studentCount: 43 },
]

export default function SectionsPage() {
  const [search, setSearch] = useState("")
  const [programFilter, setProgramFilter] = useState("all")
  const [addOpen, setAddOpen] = useState(false)

  const filtered = sectionsData.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase())
    const matchProgram = programFilter === "all" || s.program === programFilter
    return matchSearch && matchProgram
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sections"
        description="Manage sections and student groupings"
        action={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger render={<Button />}>
              <Plus className="mr-2 h-4 w-4" />Add Section
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Add Section</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Section Name</Label>
                  <Input placeholder="e.g. BSIT 1-A" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Program</Label>
                    <Select>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BSIT">BSIT</SelectItem>
                        <SelectItem value="BSCS">BSCS</SelectItem>
                        <SelectItem value="BSED">BSED</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Year Level</Label>
                    <Select>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1st Year</SelectItem>
                        <SelectItem value="2">2nd Year</SelectItem>
                        <SelectItem value="3">3rd Year</SelectItem>
                        <SelectItem value="4">4th Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Capacity</Label>
                  <Input type="number" defaultValue={40} />
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
          <Input placeholder="Search sections..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={programFilter} onValueChange={(v) => v && setProgramFilter(v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Programs</SelectItem>
            <SelectItem value="BSIT">BSIT</SelectItem>
            <SelectItem value="BSCS">BSCS</SelectItem>
            <SelectItem value="BSED">BSED</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No sections found" description="No sections match your search." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Section</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Year Level</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Enrolled</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell><Badge variant="outline">{s.program}</Badge></TableCell>
                    <TableCell>Year {s.yearLevel}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />{s.capacity}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={s.studentCount > s.capacity ? "text-destructive font-medium" : ""}>
                        {s.studentCount}
                      </span>
                    </TableCell>
                    <TableCell><Badge variant="outline">{s.department}</Badge></TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem><CalendarDays className="mr-2 h-4 w-4" />View Schedule</DropdownMenuItem>
                          <DropdownMenuItem><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
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
