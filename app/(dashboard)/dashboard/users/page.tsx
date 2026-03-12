"use client"

import { useState } from "react"
import { PageHeader } from "@/components/shared/page-header"
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
  UserCog, Plus, Search, Shield, MoreHorizontal, Pencil, UserX,
} from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-primary text-primary-foreground",
  DEPARTMENT_CHAIR: "bg-accent/20 text-accent-foreground",
  PROGRAM_HEAD: "bg-info/10 text-info",
  FACULTY: "bg-secondary text-secondary-foreground",
  STUDENT: "bg-muted text-muted-foreground",
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  DEPARTMENT_CHAIR: "Dept Chair",
  PROGRAM_HEAD: "Program Head",
  FACULTY: "Faculty",
  STUDENT: "Student",
}

const usersData = [
  { id: "1", name: "Admin User", email: "admin@slsu.edu.ph", role: "SUPER_ADMIN", isActive: true, lastLogin: "2 hours ago" },
  { id: "2", name: "Dr. Maria Santos", email: "m.santos@slsu.edu.ph", role: "DEPARTMENT_CHAIR", isActive: true, lastLogin: "1 day ago" },
  { id: "3", name: "Prof. Juan Dela Cruz", email: "j.delacruz@slsu.edu.ph", role: "PROGRAM_HEAD", isActive: true, lastLogin: "3 hours ago" },
  { id: "4", name: "Dr. Ana Reyes", email: "a.reyes@slsu.edu.ph", role: "FACULTY", isActive: true, lastLogin: "5 hours ago" },
  { id: "5", name: "Prof. Pedro Garcia", email: "p.garcia@slsu.edu.ph", role: "FACULTY", isActive: false, lastLogin: "2 weeks ago" },
  { id: "6", name: "Student One", email: "student1@slsu.edu.ph", role: "STUDENT", isActive: true, lastLogin: "1 day ago" },
]

export default function UsersPage() {
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [addOpen, setAddOpen] = useState(false)

  const filtered = usersData.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === "all" || u.role === roleFilter
    return matchSearch && matchRole
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage user accounts and role assignments"
        action={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger render={<Button />}>
              <Plus className="mr-2 h-4 w-4" />Invite User
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Invite User</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Email Address</Label>
                  <Input type="email" placeholder="user@slsu.edu.ph" />
                </div>
                <div className="grid gap-2">
                  <Label>Role</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DEPARTMENT_CHAIR">Department Chair</SelectItem>
                      <SelectItem value="PROGRAM_HEAD">Program Head</SelectItem>
                      <SelectItem value="FACULTY">Faculty</SelectItem>
                      <SelectItem value="STUDENT">Student</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button onClick={() => setAddOpen(false)}>Send Invite</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={roleFilter} onValueChange={(v) => v && setRoleFilter(v)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
            <SelectItem value="DEPARTMENT_CHAIR">Dept Chair</SelectItem>
            <SelectItem value="PROGRAM_HEAD">Program Head</SelectItem>
            <SelectItem value="FACULTY">Faculty</SelectItem>
            <SelectItem value="STUDENT">Student</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={ROLE_COLORS[u.role] ?? ""}>
                      <Shield className="mr-1 h-3 w-3" />
                      {ROLE_LABELS[u.role] ?? u.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.isActive ? "default" : "secondary"}>
                      {u.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.lastLogin}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem><Pencil className="mr-2 h-4 w-4" />Edit Role</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive"><UserX className="mr-2 h-4 w-4" />Deactivate</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
