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
  Users,
  Plus,
  Search,
  Mail,
  Briefcase,
  BookOpen,
  MoreHorizontal,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Demo data
const facultyData = [
  {
    id: "1",
    name: "Dr. Maria Santos",
    email: "m.santos@slsu.edu.ph",
    employeeId: "SLSU-2024-001",
    department: "CCS",
    specializations: ["Web Development", "Database"],
    maxUnits: 21,
    currentUnits: 18,
    isActive: true,
  },
  {
    id: "2",
    name: "Prof. Juan Dela Cruz",
    email: "j.delacruz@slsu.edu.ph",
    employeeId: "SLSU-2024-002",
    department: "CCS",
    specializations: ["Programming", "Data Structures"],
    maxUnits: 21,
    currentUnits: 21,
    isActive: true,
  },
  {
    id: "3",
    name: "Dr. Ana Reyes",
    email: "a.reyes@slsu.edu.ph",
    employeeId: "SLSU-2024-003",
    department: "CCS",
    specializations: ["Networking", "Cybersecurity"],
    maxUnits: 18,
    currentUnits: 15,
    isActive: true,
  },
  {
    id: "4",
    name: "Prof. Pedro Garcia",
    email: "p.garcia@slsu.edu.ph",
    employeeId: "SLSU-2024-004",
    department: "COED",
    specializations: ["Mathematics", "Statistics"],
    maxUnits: 21,
    currentUnits: 12,
    isActive: false,
  },
]

export default function FacultyPage() {
  const [search, setSearch] = useState("")
  const [deptFilter, setDeptFilter] = useState("all")
  const [addOpen, setAddOpen] = useState(false)

  const filtered = facultyData.filter((f) => {
    const matchSearch =
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.email.toLowerCase().includes(search.toLowerCase()) ||
      f.employeeId.toLowerCase().includes(search.toLowerCase())
    const matchDept = deptFilter === "all" || f.department === deptFilter
    return matchSearch && matchDept
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Faculty"
        description="Manage faculty members and their teaching assignments"
        action={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger render={<Button />}>
                <Plus className="mr-2 h-4 w-4" />
                Add Faculty
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Faculty Member</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="fname">Full Name</Label>
                  <Input id="fname" placeholder="e.g. Dr. Maria Santos" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="femail">Email</Label>
                  <Input id="femail" type="email" placeholder="name@slsu.edu.ph" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="feid">Employee ID</Label>
                  <Input id="feid" placeholder="SLSU-2024-XXX" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="fdept">Department</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CCS">CCS</SelectItem>
                      <SelectItem value="COED">COED</SelectItem>
                      <SelectItem value="CAS">CAS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="fmax">Max Units/Week</Label>
                  <Input id="fmax" type="number" defaultValue={21} />
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
            placeholder="Search faculty..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={deptFilter} onValueChange={(v) => v && setDeptFilter(v)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            <SelectItem value="CCS">CCS</SelectItem>
            <SelectItem value="COED">COED</SelectItem>
            <SelectItem value="CAS">CAS</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No faculty found"
          description="No faculty members match your search criteria."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Specializations</TableHead>
                  <TableHead>Load</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{f.name}</p>
                        <p className="text-xs text-muted-foreground">{f.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{f.employeeId}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{f.department}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {f.specializations.map((s) => (
                          <Badge key={s} variant="secondary" className="text-xs">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          f.currentUnits >= f.maxUnits
                            ? "text-destructive font-medium"
                            : "text-foreground"
                        }
                      >
                        {f.currentUnits}/{f.maxUnits} units
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={f.isActive ? "default" : "secondary"}>
                        {f.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
                            <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <BookOpen className="mr-2 h-4 w-4" /> View Schedule
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Briefcase className="mr-2 h-4 w-4" /> Edit Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Mail className="mr-2 h-4 w-4" /> Set Availability
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
