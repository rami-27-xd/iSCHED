"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
// Native <select> used for role/status filters
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Search, Shield, MoreHorizontal, CheckCircle2, XCircle,
  UserCog, UserX, Loader2, ShieldCheck, ShieldAlert, Building2,
} from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { safeFetch } from "@/lib/api-client"
import { useDepartments } from "@/hooks/use-data"
import { RoleGuard } from "@/components/shared/role-guard"
import { useIsMobile } from "@/hooks/use-mobile"

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-amber-100 text-amber-800 border-amber-200",
  ADMIN: "bg-blue-100 text-blue-800 border-blue-200",
  FACULTY: "bg-green-100 text-green-800 border-green-200",
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Department Chair",
  ADMIN: "Program Chair",
  FACULTY: "Faculty",
}

interface Department {
  id: string
  name: string
  abbreviation?: string
}

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  isApproved: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
  department?: Department | null
  programHead?: { programId: string; program: { id: string; name: string; abbreviation?: string } } | null
}

export default function UsersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [approvedFilter, setApprovedFilter] = useState("all")

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const [editUser, setEditUser] = useState<User | null>(null)
  const [editRole, setEditRole] = useState("")
  const [deptUser, setDeptUser] = useState<User | null>(null)
  const [deptId, setDeptId] = useState("")
  const [programId, setProgramId] = useState("")
  const { data: departments = [] } = useDepartments()

  // Fetch current user role
  const { data: currentUser } = useQuery({
    queryKey: ["current-user-me"],
    queryFn: async () => {
      const res = await fetch("/api/users/me")
      const json = await res.json()
      return json.data ?? null
    },
  })
  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN"
  const isAdmin = currentUser?.role === "ADMIN"
  const isMobile = useIsMobile()

  // Fetch programs for the selected department (used when assigning Program Chair)
  const { data: deptPrograms = [] } = useQuery<any[]>({
    queryKey: ["programs-for-dept", deptId],
    queryFn: async () => {
      if (!deptId) return []
      const res = await fetch(`/api/departments/${deptId}/programs`)
      const json = await res.json()
      if (!res.ok) return []
      return json.data ?? []
    },
    enabled: !!deptId && deptUser?.role === "ADMIN",
  })

  // Fetch users
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["users", debouncedSearch, roleFilter, approvedFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set("search", debouncedSearch)
      if (roleFilter !== "all") params.set("role", roleFilter)
      if (approvedFilter !== "all") params.set("approved", approvedFilter)
      return safeFetch<User[]>(`/api/users?${params.toString()}`)
    },
  })

  // Approve user mutation
  const approveMutation = useMutation({
    mutationFn: async ({ id, isApproved }: { id: string; isApproved: boolean }) => {
      return safeFetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isApproved }),
      })
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
      toast.success(vars.isApproved ? "User approved" : "User approval revoked")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Change role mutation
  const roleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      return safeFetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
      toast.success("Role updated")
      setEditUser(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Change department mutation (also sends programId for ADMIN users)
  const deptMutation = useMutation({
    mutationFn: async ({ id, departmentId, programId: pId }: { id: string; departmentId: string; programId?: string }) => {
      return safeFetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departmentId, ...(pId !== undefined ? { programId: pId } : {}) }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
      toast.success("Department updated")
      setDeptUser(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Toggle active mutation
  const activeMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return safeFetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      })
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
      toast.success(vars.isActive ? "User activated" : "User deactivated")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Count pending approvals
  const pendingCount = users.filter((u) => !u.isApproved).length

  return (
    <RoleGuard allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description={isAdmin
          ? "View faculty and staff in your department"
          : "Approve accounts, manage roles, and control access"
        }
      />

      {/* Pending Approvals Banner — SUPER_ADMIN only */}
      {isSuperAdmin && pendingCount > 0 && approvedFilter !== "false" && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">
              {pendingCount} user{pendingCount > 1 ? "s" : ""} pending approval
            </p>
            <p className="text-xs text-amber-600">
              Review and approve accounts to grant system access.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-amber-300 text-amber-700 hover:bg-amber-100"
            onClick={() => setApprovedFilter("false")}
          >
            View Pending
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring w-full sm:w-44"
        >
          <option value="all">All Roles</option>
          <option value="SUPER_ADMIN">Department Chair</option>
          <option value="ADMIN">Program Chair</option>
          <option value="FACULTY">Faculty</option>
        </select>
        <select
          value={approvedFilter}
          onChange={(e) => setApprovedFilter(e.target.value)}
          className="h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring w-full sm:w-44"
        >
          <option value="all">All Status</option>
          <option value="true">Approved</option>
          <option value="false">Pending</option>
        </select>
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No users found.
            </div>
          ) : isMobile ? (
            /* ── Mobile: card list ── */
            <div className="divide-y divide-border">
              {users.map((u) => (
                <div key={u.id} className={`p-4 ${!u.isApproved ? "bg-amber-50/50" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{u.firstName} {u.lastName}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <Badge variant="outline" className={`text-[10px] ${ROLE_COLORS[u.role] ?? ""}`}>
                          <Shield className="mr-1 h-2.5 w-2.5" />
                          {ROLE_LABELS[u.role] ?? u.role}
                        </Badge>
                        {u.isApproved ? (
                          <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                            Approved
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                            Pending
                          </Badge>
                        )}
                        <Badge variant={u.isActive ? "default" : "secondary"} className="text-[10px]">
                          {u.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      {u.department && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {u.department.abbreviation ?? u.department.name}
                          {u.role === "ADMIN" && u.programHead?.program && ` · ${u.programHead.program.abbreviation ?? u.programHead.program.name}`}
                        </p>
                      )}
                    </div>
                    {isSuperAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" />}>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!u.isApproved ? (
                            <DropdownMenuItem onClick={() => approveMutation.mutate({ id: u.id, isApproved: true })}>
                              <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />Approve User
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => approveMutation.mutate({ id: u.id, isApproved: false })}>
                              <XCircle className="mr-2 h-4 w-4 text-amber-600" />Revoke Approval
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => { setEditUser(u); setEditRole(u.role) }}>
                            <UserCog className="mr-2 h-4 w-4" />Change Role
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setDeptUser(u); setDeptId(u.department?.id ?? ""); setProgramId(u.programHead?.programId ?? "") }}>
                            <Building2 className="mr-2 h-4 w-4" />Change Department
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {u.isActive ? (
                            <DropdownMenuItem className="text-destructive" onClick={() => activeMutation.mutate({ id: u.id, isActive: false })}>
                              <UserX className="mr-2 h-4 w-4" />Deactivate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => activeMutation.mutate({ id: u.id, isActive: true })}>
                              <ShieldCheck className="mr-2 h-4 w-4 text-green-600" />Reactivate
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Table className="min-w-[750px]">
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Registered</TableHead>
                  {isSuperAdmin && <TableHead className="w-10"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} className={!u.isApproved ? "bg-amber-50/50" : ""}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {u.firstName} {u.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ROLE_COLORS[u.role] ?? ""}>
                        <Shield className="mr-1 h-3 w-3" />
                        {ROLE_LABELS[u.role] ?? u.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.department ? (
                        <div>
                          <span className="text-sm">
                            {u.department.abbreviation ?? u.department.name}
                          </span>
                          {u.role === "ADMIN" && u.programHead?.program && (
                            <p className="text-xs text-muted-foreground">
                              {u.programHead.program.abbreviation ?? u.programHead.program.name}
                            </p>
                          )}
                          {u.role === "ADMIN" && !u.programHead && (
                            <p className="text-xs text-amber-600">No program assigned</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not assigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.isApproved ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Approved
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          <ShieldAlert className="mr-1 h-3 w-3" />
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.isActive ? "default" : "secondary"}>
                        {u.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </TableCell>
                    {isSuperAdmin && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {/* Approve / Revoke */}
                          {!u.isApproved ? (
                            <DropdownMenuItem
                              onClick={() => approveMutation.mutate({ id: u.id, isApproved: true })}
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                              Approve User
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => approveMutation.mutate({ id: u.id, isApproved: false })}
                            >
                              <XCircle className="mr-2 h-4 w-4 text-amber-600" />
                              Revoke Approval
                            </DropdownMenuItem>
                          )}

                          {/* Change Role */}
                          <DropdownMenuItem
                            onClick={() => {
                              setEditUser(u)
                              setEditRole(u.role)
                            }}
                          >
                            <UserCog className="mr-2 h-4 w-4" />
                            Change Role
                          </DropdownMenuItem>

                          {/* Change Department */}
                          <DropdownMenuItem
                            onClick={() => {
                              setDeptUser(u)
                              setDeptId(u.department?.id ?? "")
                              setProgramId(u.programHead?.programId ?? "")
                            }}
                          >
                            <Building2 className="mr-2 h-4 w-4" />
                            Change Department
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          {/* Activate/Deactivate */}
                          {u.isActive ? (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => activeMutation.mutate({ id: u.id, isActive: false })}
                            >
                              <UserX className="mr-2 h-4 w-4" />
                              Deactivate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => activeMutation.mutate({ id: u.id, isActive: true })}
                            >
                              <ShieldCheck className="mr-2 h-4 w-4 text-green-600" />
                              Reactivate
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Change Role Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
          </DialogHeader>
          {editUser && (
            <div className="space-y-4 py-2">
              <div>
                <p className="text-sm font-medium">{editUser.firstName} {editUser.lastName}</p>
                <p className="text-xs text-muted-foreground">{editUser.email}</p>
              </div>
              <div className="space-y-2">
                <Label>New Role</Label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="SUPER_ADMIN">Department Chair (Super Admin)</option>
                  <option value="ADMIN">Program Chair (Admin)</option>
                  <option value="FACULTY">Faculty</option>
                </select>
                {editRole === "SUPER_ADMIN" && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3" />
                    This grants full system access including user management.
                  </p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button
              onClick={() => editUser && roleMutation.mutate({ id: editUser.id, role: editRole })}
              disabled={roleMutation.isPending || editRole === editUser?.role}
            >
              {roleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Department Dialog */}
      <Dialog open={!!deptUser} onOpenChange={(open) => !open && setDeptUser(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Department</DialogTitle>
          </DialogHeader>
          {deptUser && (
            <div className="space-y-4 py-2">
              <div>
                <p className="text-sm font-medium">{deptUser.firstName} {deptUser.lastName}</p>
                <p className="text-xs text-muted-foreground">{deptUser.email}</p>
                <Badge variant="outline" className={`mt-1 ${ROLE_COLORS[deptUser.role] ?? ""}`}>
                  {ROLE_LABELS[deptUser.role] ?? deptUser.role}
                </Badge>
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <select
                  value={deptId}
                  onChange={(e) => { setDeptId(e.target.value); setProgramId("") }}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Not assigned</option>
                  {(departments as any[]).map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Program selector — only for ADMIN (Program Chair) */}
              {deptUser.role === "ADMIN" && deptId && (
                <div className="space-y-2">
                  <Label>Program</Label>
                  <select
                    value={programId}
                    onChange={(e) => setProgramId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Select a program...</option>
                    {(deptPrograms as any[]).map((p: any) => (
                      <option key={p.id} value={p.id}>{p.abbreviation ?? p.name} — {p.name}</option>
                    ))}
                  </select>
                  {!programId && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <ShieldAlert className="h-3 w-3" />
                      Program Chair must be assigned to a program to manage schedules.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeptUser(null)}>Cancel</Button>
            <Button
              onClick={() => deptUser && deptMutation.mutate({
                id: deptUser.id,
                departmentId: deptId,
                ...(deptUser.role === "ADMIN" ? { programId: programId || "" } : {}),
              })}
              disabled={deptMutation.isPending || (deptId === (deptUser?.department?.id ?? "") && programId === (deptUser?.programHead?.programId ?? ""))}
            >
              {deptMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </RoleGuard>
  )
}
