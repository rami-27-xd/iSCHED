"use client"

import { useState, useMemo } from "react"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { DoorOpen, Plus, Search, Building2, Monitor, MoreHorizontal, Loader2, ChevronDown, ChevronRight } from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { useRoomList, useCreateRoom, useUpdateRoom, useBuildings, useCreateBuilding } from "@/hooks/use-data"
import { RoleGuard } from "@/components/shared/role-guard"

const ROOM_TYPE_LABELS: Record<string, string> = {
  LECTURE_ROOM: "Lecture Room",
  LABORATORY: "Laboratory",
}

const ROOM_TYPE_COLORS: Record<string, string> = {
  LECTURE_ROOM: "bg-primary/10 text-primary",
  LABORATORY: "bg-accent/10 text-accent-foreground",
}

const INITIAL_ROOM_FORM = { name: "", code: "", buildingId: "", type: "" }

export default function RoomsPage() {
  const [search, setSearch] = useState("")
  const [addRoomOpen, setAddRoomOpen] = useState(false)
  const [addRoomBuildingId, setAddRoomBuildingId] = useState("")
  const [addBuildingOpen, setAddBuildingOpen] = useState(false)
  const [newBuildingName, setNewBuildingName] = useState("")
  const [newBuildingCode, setNewBuildingCode] = useState("")
  const [editOpen, setEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<any>(null)
  const [roomForm, setRoomForm] = useState(INITIAL_ROOM_FORM)
  const [expandedBuildings, setExpandedBuildings] = useState<Set<string>>(new Set())

  const { data: buildings = [], isLoading: loadingBuildings } = useBuildings()
  const { data: rooms = [], isLoading: loadingRooms } = useRoomList()
  const createRoom = useCreateRoom()
  const updateRoom = useUpdateRoom()
  const createBuilding = useCreateBuilding()

  const isLoading = loadingBuildings || loadingRooms

  // Group rooms by building
  const buildingsWithRooms = useMemo(() => {
    return buildings.map((b: any) => {
      const buildingRooms = rooms.filter((r: any) => r.buildingId === b.id)
      const filteredRooms = search
        ? buildingRooms.filter((r: any) =>
            r.name.toLowerCase().includes(search.toLowerCase()) ||
            r.code.toLowerCase().includes(search.toLowerCase())
          )
        : buildingRooms
      return { ...b, filteredRooms, totalRooms: buildingRooms.length }
    }).filter((b: any) => !search || b.filteredRooms.length > 0 || b.name.toLowerCase().includes(search.toLowerCase()))
  }, [buildings, rooms, search])

  function toggleBuilding(id: string) {
    setExpandedBuildings((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function openAddRoom(buildingId: string) {
    setRoomForm({ ...INITIAL_ROOM_FORM, buildingId })
    setAddRoomBuildingId(buildingId)
    setAddRoomOpen(true)
  }

  function openEdit(r: any) {
    setEditTarget(r)
    setRoomForm({ name: r.name, code: r.code, buildingId: r.buildingId, type: r.type })
    setEditOpen(true)
  }

  async function handleCreateRoom() {
    const { name, code, buildingId, type } = roomForm
    if (!name || !code || !buildingId || !type) return toast.error("Please fill in all required fields")
    try {
      await createRoom.mutateAsync({ name, code, buildingId, type })
      setAddRoomOpen(false)
      setRoomForm(INITIAL_ROOM_FORM)
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  async function handleUpdateRoom() {
    if (!editTarget) return
    try {
      await updateRoom.mutateAsync({ id: editTarget.id, ...roomForm })
      setEditOpen(false)
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  async function handleCreateBuilding() {
    if (!newBuildingName) return toast.error("Building name is required")
    try {
      await createBuilding.mutateAsync({ name: newBuildingName, code: newBuildingCode || undefined })
      setAddBuildingOpen(false)
      setNewBuildingName("")
      setNewBuildingCode("")
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  return (
    <RoleGuard allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
    <div className="space-y-6">
      <PageHeader
        title="Buildings"
        description="Manage buildings and their rooms, labs, and configurations"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setAddBuildingOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />Add Building
            </Button>
            <Button onClick={() => { setRoomForm(INITIAL_ROOM_FORM); setAddRoomOpen(true) }}>
              <Plus className="mr-2 h-4 w-4" />Add Room
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search buildings or rooms..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-24 items-center justify-center text-muted-foreground text-sm">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading...
        </div>
      ) : buildingsWithRooms.length === 0 ? (
        <EmptyState icon={Building2} title="No buildings found" description={search ? "No buildings or rooms match your search." : "No buildings have been added yet."} />
      ) : (
        <div className="space-y-3">
          {buildingsWithRooms.map((building: any) => {
            const isExpanded = expandedBuildings.has(building.id)
            return (
              <Card key={building.id}>
                <CardHeader
                  className="cursor-pointer hover:bg-muted/30 transition-colors py-4"
                  onClick={() => toggleBuilding(building.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <Building2 className="h-5 w-5 text-[#1B4332]" />
                      <div className="text-left">
                        <CardTitle className="text-sm font-semibold">{building.name}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {building.code && <span className="font-mono mr-2">{building.code}</span>}
                          {building.totalRooms} room{building.totalRooms !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); openAddRoom(building.id) }}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />Add Room
                    </Button>
                  </div>
                </CardHeader>
                {isExpanded && (
                  <CardContent className="pt-0 pb-4">
                    {building.filteredRooms.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                        No rooms in this building yet.
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        {building.filteredRooms.map((room: any) => (
                          <div
                            key={room.id}
                            className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <DoorOpen className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">{room.name}</p>
                                <p className="text-xs text-muted-foreground font-mono">{room.code}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className={ROOM_TYPE_COLORS[room.type] ?? ""}>
                                {ROOM_TYPE_LABELS[room.type] ?? room.type}
                              </Badge>
                              <Badge variant={room.isActive ? "default" : "secondary"}>
                                {room.isActive ? "Active" : "Inactive"}
                              </Badge>
                              <DropdownMenu>
                                <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openEdit(room)}>
                                    <Monitor className="mr-2 h-4 w-4" />Edit
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Add Building Dialog */}
      <Dialog open={addBuildingOpen} onOpenChange={setAddBuildingOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Add Building</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Building Name</Label>
              <Input placeholder="e.g. CCS Building" value={newBuildingName} onChange={(e) => setNewBuildingName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Building Code (optional)</Label>
              <Input placeholder="e.g. CCS" value={newBuildingCode} onChange={(e) => setNewBuildingCode(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddBuildingOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateBuilding} disabled={createBuilding.isPending}>
              {createBuilding.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Building
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Room Dialog */}
      <Dialog open={addRoomOpen} onOpenChange={setAddRoomOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Room</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Room Name</Label>
                <Input placeholder="e.g. Room 101" value={roomForm.name} onChange={(e) => setRoomForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Room Code</Label>
                <Input placeholder="e.g. CCS-101" value={roomForm.code} onChange={(e) => setRoomForm((f) => ({ ...f, code: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Building</Label>
              <select
                value={roomForm.buildingId}
                onChange={(e) => setRoomForm((f) => ({ ...f, buildingId: e.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select building</option>
                {buildings.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Room Type</Label>
              <select
                value={roomForm.type}
                onChange={(e) => setRoomForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select type</option>
                <option value="LECTURE_ROOM">Lecture Room</option>
                <option value="LABORATORY">Laboratory</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddRoomOpen(false); setRoomForm(INITIAL_ROOM_FORM) }}>Cancel</Button>
            <Button onClick={handleCreateRoom} disabled={createRoom.isPending}>
              {createRoom.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Room Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit Room — {editTarget?.code}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Room Name</Label>
              <Input value={roomForm.name} onChange={(e) => setRoomForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Room Code</Label>
              <Input value={roomForm.code} onChange={(e) => setRoomForm((f) => ({ ...f, code: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Building</Label>
              <select
                value={roomForm.buildingId}
                onChange={(e) => setRoomForm((f) => ({ ...f, buildingId: e.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select building</option>
                {buildings.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Type</Label>
              <select
                value={roomForm.type}
                onChange={(e) => setRoomForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select type</option>
                <option value="LECTURE_ROOM">Lecture Room</option>
                <option value="LABORATORY">Laboratory</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateRoom} disabled={updateRoom.isPending}>
              {updateRoom.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </RoleGuard>
  )
}
