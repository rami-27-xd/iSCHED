import { NextResponse } from "next/server"
import { getAuthenticatedUser, getCurrentUser, getUserDepartmentId } from "@/lib/auth"
import { db } from "@/lib/db"
import { SchedulingEngine, SchedulingError, type GenerationResult, type LockedEntry } from "@/lib/services/scheduler"
import { apiResponse, apiError } from "@/lib/api-helpers"
import { createNotification } from "@/lib/notifications"
import { syncFacultySpecializations } from "@/lib/services/sync-specializations"

// Allow up to 60 seconds for schedule generation
export const maxDuration = 60

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json(apiError("Unauthorized"), { status: 401 })
    }

    const dbUser = await getCurrentUser()
    if (!dbUser || !["SUPER_ADMIN", "ADMIN"].includes(dbUser.role)) {
      return NextResponse.json(
        apiError("Only Department Chairpersons and Program Chairpersons can run schedule generation"),
        { status: 403 }
      )
    }

    const isAdmin = dbUser.role === "ADMIN"
    const isSuperAdmin = dbUser.role === "SUPER_ADMIN"

    const { id } = await params

    const schedule = await db.schedule.findUnique({
      where: { id },
      include: { semester: true, department: { include: { college: true } } },
    })

    if (!schedule) {
      return NextResponse.json(apiError("Schedule not found"), { status: 404 })
    }

    // Workflow sequence (per system spec):
    //   Step 2 — ADMIN (Program Chair): generates major subjects on DRAFT only.
    //     No dependency on SUPER_ADMIN having run — Program Chairs go first.
    //   Step 3 — SUPER_ADMIN (Dept Chair): generates GEC/minor subjects AFTER reviewing
    //     Program Chair submissions. Gate: at least one ADMIN schedule for this semester
    //     must be in PENDING_APPROVAL or PUBLISHED state.
    if (isAdmin && schedule.status !== "DRAFT") {
      return NextResponse.json(
        apiError("Program Chairs can only generate schedules in Draft status"),
        { status: 400 }
      )
    }

    // CAS has no Program Chairs — the Dept Chair generates all subjects directly.
    // Detect this early so the submission gate and section scoping can be skipped for CAS.
    let isCasAdmin = false
    if (isSuperAdmin) {
      const userDeptId = getUserDepartmentId(dbUser)
      if (userDeptId) {
        const userDeptRecord = await db.department.findUnique({
          where: { id: userDeptId },
          include: { college: true },
        })
        isCasAdmin = userDeptRecord?.college?.abbreviation === "CAS"
      }
    }

    // Determine if the CAS chair is generating their OWN CAS schedule or injecting
    // GEC into another department's schedule (e.g. CIT, CAHM).
    // - Own schedule  → generate cluster majors + cluster GEC for CAS sections only.
    // - Other dept    → generate ONLY cluster GEC codes for that dept's sections.
    //   This keeps each department's schedule isolated: CIT schedule has CIT majors +
    //   GEC; CAS schedule has CAS majors + GEC. BAComm sections never appear in CIT.
    const isCasOwnSchedule = isCasAdmin && schedule.department?.college?.abbreviation === "CAS"
    const isCasInjectingOther = isCasAdmin && !isCasOwnSchedule

    // Each CAS Dept Chair is assigned to one of three clusters (Social Sciences, LLH, MNS).
    // When a cluster is assigned, generation is scoped to only the programs in that cluster.
    // clusterId=null means the chair has full CAS access (fallback / super-user).
    let casClusterProgramIds: string[] | null = null
    if (isCasAdmin && (dbUser as any).clusterId) {
      const clusterProgs = await db.program.findMany({
        where: { clusterId: (dbUser as any).clusterId },
        select: { id: true },
      })
      casClusterProgramIds = clusterProgs.map((p: any) => p.id)
    }

    // Per-cluster GEC/GEL subject codes (from the compliance specification).
    // Each Dept Chair generates ONLY the GEC subjects assigned to their cluster.
    // NSTP/PATHFIT are excluded system-wide (manually scheduled).
    const CLUSTER_GEC_CODES: Record<string, string[]> = {
      "Social Sciences":                         ["GEC01", "GEC02", "GEC03", "GEC04", "GEC09", "GEL07", "GEL10"],
      "Languages, Literature, and Humanities":   ["GEC06", "GEC07", "GEC10", "GEC11", "GEC12", "GEC13", "GEC14"],
      "Mathematics and Natural Sciences":        ["GEC05", "GEC08", "GEL01"],
    }

    // Resolve cluster GEC codes for this CAS chair.
    // NSTP/PATHFIT are always excluded from auto-generation (manually scheduled).
    let clusterGecCodes: string[] = []
    if (isCasAdmin && (dbUser as any).clusterId) {
      const userCluster = await db.facultyCluster.findUnique({
        where: { id: (dbUser as any).clusterId },
        select: { name: true },
      })
      clusterGecCodes = CLUSTER_GEC_CODES[userCluster?.name ?? ""] ?? []
    }

    // Unified submission gate — applies when SUPER_ADMIN is generating GEC into a schedule
    // whose department has Program Chairs (i.e. non-CAS own-schedule cases):
    //   • CAS chair injecting another dept's schedule → check that dept's chairs submitted
    //   • Non-CAS SUPER_ADMIN (hypothetical) → check their own dept's chairs submitted
    // CAS own-schedule generation bypasses the gate (no Program Chairs in CAS).
    let submittedProgramIds: string[] = []
    if (isSuperAdmin && !isCasOwnSchedule && schedule.semesterId) {
      // For CAS injecting: gate on the schedule's dept. For non-CAS SUPER_ADMIN: user's dept.
      const gateDeptId = isCasInjectingOther
        ? (schedule.departmentId ?? undefined)
        : (getUserDepartmentId(dbUser) ?? schedule.departmentId ?? undefined)

      const [allDeptPrograms, submittedSchedules] = await Promise.all([
        // Only programs with an assigned Program Chair count toward the gate —
        // a program with no chair account can never submit, and would lock
        // GEC generation forever.
        db.program.findMany({
          where: { departmentId: gateDeptId ?? "", head: { isNot: null } },
          select: { id: true, name: true },
        }),
        db.schedule.findMany({
          where: {
            semesterId: schedule.semesterId,
            status: { in: ["PENDING_APPROVAL", "PUBLISHED"] },
            ...(gateDeptId ? { departmentId: gateDeptId } : {}),
          },
          select: { id: true },
        }),
      ])

      // A program counts as "submitted" when a submitted/published schedule
      // contains entries for its sections. Chairs share one schedule per
      // department, so crediting by schedule creator would only count the
      // chair who created the row — not everyone who generated into it.
      const submittedEntries = await db.scheduleEntry.findMany({
        where: { scheduleId: { in: submittedSchedules.map((s: any) => s.id) } },
        select: { section: { select: { yearLevel: { select: { programId: true } } } } },
      })
      submittedProgramIds = [
        ...new Set(
          submittedEntries
            .map((e: any) => e.section?.yearLevel?.programId)
            .filter((pid: any): pid is string => !!pid)
        ),
      ]

      const submittedSet = new Set(submittedProgramIds)
      const unsubmitted = allDeptPrograms.filter((p: any) => !submittedSet.has(p.id))

      if (unsubmitted.length > 0) {
        const names = unsubmitted.slice(0, 3).map((p: any) => p.name).join(", ")
        const more = unsubmitted.length > 3 ? ` and ${unsubmitted.length - 3} more` : ""
        return NextResponse.json(
          apiError(
            `${unsubmitted.length} program(s) have not yet submitted their schedules: ${names}${more}. ` +
            "All Program Chairpersons in the department must submit before GEC subjects can be generated."
          ),
          { status: 400 }
        )
      }
    }

    // For ADMIN: resolve their program so we can scope subjects and sections
    const programId: string | null = isAdmin
      ? ((dbUser as any).programHead?.programId ?? null)
      : null
    const programDepartmentId: string | null = isAdmin
      ? ((dbUser as any).programHead?.program?.departmentId ?? null)
      : null

    if (isAdmin && !programId) {
      return NextResponse.json(
        {
          success: false,
          error: "Program Chair not assigned to a program",
          details: ["Your account must be linked to a specific program before generating a schedule."],
        },
        { status: 400 }
      )
    }

    // Department to scope against:
    //   ADMIN (Program Chair) — always use their own program's department (not the schedule's).
    //   SUPER_ADMIN (Dept Chair) — use THEIR department from the user record (departmentChair).
    //     This is essential now that there are 3 distinct CAS sub-departments; each chair
    //     should only generate GEC subjects belonging to their own sub-department.
    //     Falls back to schedule.departmentId for backwards-compat while old chairs are migrated.
    const deptId: string | undefined = isAdmin
      ? (programDepartmentId ?? schedule.departmentId ?? undefined)
      : (getUserDepartmentId(dbUser) ?? schedule.departmentId ?? undefined)

    // Prefixes excluded from all auto-generation (NSTP/PATHFIT are manually scheduled)
    const EXCLUDED_AUTO = ["NSTP", "NST", "PATHFIT", "PATHFit"]
    const notAutoExcluded = { AND: EXCLUDED_AUTO.map(p => ({ code: { not: { startsWith: p } } })) }

    // GEC prefix codes — used to exclude GEC from ADMIN (major-subjects-only) scope
    const GEC_PREFIXES = ["GEC", "GEL"]
    const notGecFilter = {
      AND: GEC_PREFIXES.map((p) => ({ code: { not: { startsWith: p } } })),
    }

    // Major subjects must match the schedule's semester (a 1st-sem schedule must not
    // generate 2nd-sem subjects like FLS02). GEC is exempt — its semester placement
    // varies per program, so the engine's year-level match handles it instead.
    const semType = schedule.semester?.type ?? null
    const semesterFilter = semType ? { semester: semType } : {}

    const subjectWhere: any = isAdmin
      ? {
          // ADMIN (Program Chair): major subjects only — no GEC (Dept Chair handles those)
          OR: [
            // This program's specific major subjects
            { programId, ...semesterFilter },
            // Dept-wide non-GEC subjects (e.g. RES, FLO, OJT)
            { programId: null, departmentId: deptId, ...semesterFilter, ...notGecFilter },
          ],
        }
      : isCasAdmin
        ? isCasInjectingOther
          ? // CAS chair generating INTO another dept's schedule (e.g. CIT):
            // ONLY inject cluster GEC codes — no major subjects from CAS programs.
            // departmentId keeps this from matching the target dept's own
            // programId-null subjects (e.g. CIT's dept-wide RES/OJT).
            clusterGecCodes.length > 0
              ? { departmentId: deptId, programId: null, code: { in: clusterGecCodes } }
              : { departmentId: deptId, programId: null, OR: GEC_PREFIXES.map(p => ({ code: { startsWith: p } })), ...notAutoExcluded }
          : // CAS chair on their OWN CAS schedule: cluster majors + cluster GEC.
            casClusterProgramIds
              ? {
                  departmentId: deptId,
                  OR: [
                    { programId: { in: casClusterProgramIds }, ...semesterFilter },
                    ...(clusterGecCodes.length > 0
                      ? [{ programId: null, code: { in: clusterGecCodes } }]
                      : [{ programId: null, ...notAutoExcluded }]),
                  ],
                }
              : { departmentId: deptId, ...semesterFilter, ...notAutoExcluded }
        : {
            // Non-CAS SUPER_ADMIN: generates ONLY GEC/GEL subjects.
            departmentId: deptId,
            programId: null,
            OR: GEC_PREFIXES.map(p => ({ code: { startsWith: p } })),
            ...notAutoExcluded,
          }

    const [subjects, faculty, rooms, sections] = await Promise.all([
      db.subject.findMany({
        where: subjectWhere,
        include: { department: true },
      }),
      db.faculty.findMany({
        where: {
          isActive: true,
          // SUPER_ADMIN (Dept Chair): Scope to CAS college (not just the sub-dept), because
          //   faculty records haven't been redistributed to the 3 sub-departments yet. All CAS
          //   faculty are candidates; availability + specialization constraints filter them.
          // ADMIN: their own dept faculty pool (program-specific + dept-wide).
          ...(isSuperAdmin
            ? { department: { college: { abbreviation: "CAS" } } }
            : { departmentId: deptId, OR: [{ programId }, { programId: null }] }
          ),
        },
        include: {
          user: true,
          availability: { where: { semesterId: schedule.semesterId } },
          buildingAvailability: { where: { semesterId: schedule.semesterId } },
        },
      }),
      db.room.findMany({
        where: (() => {
          // When injecting GEC into another dept's schedule, scope rooms to that dept
          // (GEC classes run in the target dept's buildings, not CAS buildings).
          const roomDeptId = isCasInjectingOther ? (schedule.departmentId ?? deptId) : deptId
          return {
            isActive: true,
            ...(roomDeptId ? {
              AND: [
                {
                  building: {
                    OR: [
                      { departments: { none: {} } },
                      { departments: { some: { departmentId: roomDeptId } } },
                    ],
                  },
                },
                {
                  OR: [
                    { departments: { none: {} } },
                    { departments: { some: { departmentId: roomDeptId } } },
                  ],
                },
              ],
            } : {}),
          }
        })(),
        include: { building: true, departments: true },
      }),
      db.section.findMany({
        where: isAdmin
          ? { yearLevel: { programId: programId! } }
          : isCasInjectingOther
            ? // Injecting GEC into another dept's schedule: only THAT dept's sections.
              // BAComm/BAHist/etc. (CAS sections) must NOT appear here.
              { yearLevel: { program: { departmentId: schedule.departmentId ?? undefined } } }
            : isCasOwnSchedule
              ? // Own CAS schedule: cluster program sections only.
                casClusterProgramIds
                  ? { yearLevel: { programId: { in: casClusterProgramIds } } }
                  : { yearLevel: { program: { departmentId: deptId } } }
            : {
                // Non-CAS SUPER_ADMIN: only sections from programs whose Program Chair
                // has submitted a schedule.
                yearLevel: { programId: { in: submittedProgramIds } },
              },
        include: { yearLevel: { include: { program: true } } },
      }),
    ])

    // Transform data for the scheduling engine
    const subjectInputs = subjects.map((s: any) => ({
      id: s.id,
      code: s.code,
      title: s.title,
      hoursPerWeek: s.hoursPerWeek,
      type: s.type as "LECTURE" | "LABORATORY",
      requiredRoomType: s.requiredRoomType.map(String),
      units: s.units,
      departmentCode: s.department?.abbreviation,
      year: s.year ?? 1,
      programId: s.programId ?? null,
      requiredLabSpecialization: s.requiredLabSpecialization ?? null,
    }))

    const facultyInputs = faculty.map((f: any) => ({
      id: f.id,
      name: `${f.user.firstName} ${f.user.lastName}`,
      specializations: f.specializations,
      sectionCounts: (f.sectionCounts as Record<string, number>) ?? {},
      maxUnitsPerWeek: f.maxUnitsPerWeek,
      availability: f.availability.map((a: any) => ({
        day: a.day as any,
        startTime: a.startTime,
        endTime: a.endTime,
      })),
      // Collect the distinct building IDs this faculty can teach in this semester
      allowedBuildingIds: f.buildingAvailability.map((b: any) => b.buildingId),
    }))

    const roomInputs = rooms.map((r: any) => ({
      id: r.id,
      code: r.code,
      type: r.type,
      buildingId: r.building?.id ?? r.buildingId,
      buildingCode: r.building?.code,
      labSpecialization: r.labSpecialization ?? null,
    }))

    const sectionInputs = sections.map((s: any) => ({
      id: s.id,
      name: s.name,
      yearLevel: s.yearLevel?.level ?? 1,
      programId: s.yearLevel?.programId ?? null,
    }))

    // Pre-flight: sections must exist
    if (sectionInputs.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: isAdmin ? "No sections found for your program" : "No sections found for this department",
          details: [
            isAdmin
              ? "Add year levels and sections for your program before generating a schedule"
              : "Add year levels and sections for the programs in this department before generating a schedule",
          ],
        },
        { status: 422 }
      )
    }

    // Pre-flight: rooms must exist
    if (roomInputs.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No active rooms found",
          details: ["Add at least one active room in Buildings & Rooms before generating a schedule"],
        },
        { status: 422 }
      )
    }

    const facultyWithAvailability = facultyInputs.filter((f: any) => f.availability.length > 0)
    if (facultyWithAvailability.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No faculty have availability configured for this semester",
          details: [
            "Go to Faculty Availability and set available days/times for at least one faculty member",
            `Semester: ${schedule.semester?.type ?? "Unknown"}`,
            `Faculty loaded: ${facultyInputs.length} (${isAdmin ? "program + dept-wide pool" : "full department"})`,
          ],
        },
        { status: 422 }
      )
    }

    // Load existing entries this run must not displace:
    //   1. Entries in THIS schedule for subjects NOT being regenerated now
    //      (e.g. major-subject rows when SUPER_ADMIN regenerates GEC only, and vice-versa).
    //   2. Entries in OTHER schedules for the same semester
    //      (prevents two concurrent departments from double-booking the same room/faculty).
    const subjectIdsBeingRegenerated = subjectInputs.map((s: any) => s.id)
    const rawLockedEntries = await db.scheduleEntry.findMany({
      where: {
        OR: [
          // Intra-schedule: entries for subjects we are NOT regenerating
          { scheduleId: id, subjectId: { notIn: subjectIdsBeingRegenerated } },
          // Cross-schedule: all entries in other non-archived schedules for the same semester
          { schedule: { semesterId: schedule.semesterId, isArchived: false, id: { not: id } } },
        ],
      },
      select: {
        facultyId: true,
        roomId: true,
        sectionId: true,
        set: true,
        day: true,
        startTime: true,
        endTime: true,
      },
    })
    const lockedEntries: LockedEntry[] = rawLockedEntries.map((e: any) => ({
      facultyId: e.facultyId,
      roomId: e.roomId,
      sectionId: e.sectionId,
      set: e.set ?? null,
      day: e.day,
      startTime: e.startTime,
      endTime: e.endTime,
    }))

    const engine = new SchedulingEngine(
      subjectInputs,
      facultyInputs,
      roomInputs,
      sectionInputs,
      {},
      lockedEntries
    )

    console.log(
      `[generate] role:${dbUser.role} dept:${deptId?.slice(-6) ?? "all"} program:${programId?.slice(-6) ?? "all"} | ` +
      `${subjectInputs.length} subjects (${isAdmin ? "major only, GEC/PATHFIT excluded" : "all incl. GEC/PATHFIT"}), ` +
      `${facultyInputs.length} faculty (${facultyWithAvailability.length} with avail), ` +
      `${roomInputs.length} rooms, ${sectionInputs.length} sections`
    )

    let result: GenerationResult
    try {
      result = await engine.generate()
    } catch (engineError: any) {
      if (engineError.name === "SchedulingError") throw engineError
      console.error("[generate] Unexpected engine error:", engineError)
      throw new SchedulingError("Scheduler encountered an unexpected error", [
        engineError.message ?? "Unknown error",
      ])
    }

    console.log(
      `[generate] Scheduler completed: ${result.assignments.length} assignments, ${result.unassigned.length} unassigned`
    )

    // Build a lookup so we can check subject type when persisting
    const subjectTypeMap = new Map(subjects.map((s: any) => [s.id, s.type as string]))

    // Expand assignments into ScheduleEntry rows:
    //   Labs    → one entry (single continuous session), duplicated as Set A and Set B
    //   Lectures → one entry per session (primary + extraSessions from the day-group pattern)
    type EntryRow = {
      scheduleId: string; subjectId: string; facultyId: string; roomId: string
      sectionId: string; day: string; startTime: string; endTime: string
      createdBy: string; set: string | null
    }
    const entryRows: EntryRow[] = (result.assignments as any[]).flatMap((a): EntryRow[] => {
      const isLab = subjectTypeMap.get(a.subjectId) === "LABORATORY"
      const base = {
        scheduleId: id, subjectId: a.subjectId, facultyId: a.facultyId,
        roomId: a.roomId, sectionId: a.sectionId, createdBy: dbUser.id,
      }
      if (isLab) {
        // Labs: each set was scheduled independently — one entry per set, different slots
        return [{ ...base, day: a.day, startTime: a.startTime, endTime: a.endTime, set: a.set ?? "A" }]
      }
      // Lectures: one row per session day (primary + extraSessions from day-group pattern)
      const sessions: { day: string; startTime: string; endTime: string }[] = [
        { day: a.day, startTime: a.startTime, endTime: a.endTime },
        ...(a.extraSessions ?? []),
      ]
      return sessions.map(s => ({ ...base, day: s.day, startTime: s.startTime, endTime: s.endTime, set: null }))
    })

    // Safety check: if the engine returned 0 assignments AND every subject landed in
    // the unassigned queue, refuse to clear existing entries. This prevents a config
    // mistake (e.g. deleted availability) from silently wiping all manually-placed entries.
    if (entryRows.length === 0 && result.unassigned.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Generation produced no schedulable entries",
          details: [
            `All ${result.unassigned.length} subject-section task(s) could not be assigned.`,
            "Existing entries have been preserved. Fix the issues below and try again.",
            ...result.unassigned.slice(0, 5).map(u => `• ${u.subjectCode} → ${u.sectionName}: ${u.reason}`),
            ...(result.unassigned.length > 5 ? [`...and ${result.unassigned.length - 5} more`] : []),
          ],
        },
        { status: 422 }
      )
    }

    // Persist results:
    //   Both roles use a scoped delete — only remove entries for subjects in THIS run.
    //   This preserves major subject entries when the Dept Chair regenerates GEC into
    //   a shared schedule, and preserves GEC entries when the Program Chair regenerates
    //   their major subjects. Full-schedule wipes are too destructive when one schedule
    //   serves both roles.
    //
    //   CAS cluster chairs share one schedule but each owns a subset of sections.
    //   GEC subjects (programId=null) appear in every cluster's subject scope, so a plain
    //   subjectId-only delete would wipe another chair's GEC entries for their sections.
    //   Solution: scope the delete to THIS chair's sections when they have a cluster.
    //
    //   Unassigned queue — full delete: always represents the LATEST run.
    const subjectIds = subjects.map((s: any) => s.id)
    const sectionIds = sections.map((s: any) => s.id)

    const entryDeleteWhere = isCasAdmin && casClusterProgramIds
      ? { scheduleId: id, subjectId: { in: subjectIds }, sectionId: { in: sectionIds } }
      : { scheduleId: id, subjectId: { in: subjectIds } }

    // Unassigned-queue delete scope:
    //   CAS chair on OWN schedule — wipe by SECTION. Subject-scoped deletes miss stale
    //     entries whose subjects changed programId between runs (e.g. FLS moved
    //     BAComm → BAHist). Their cluster sections belong to them alone, so this is safe.
    //   CAS chair INJECTING another dept — wipe only their own GEC rows (subject+section).
    //     A section-wide wipe here would erase the target dept chair's unassigned queue.
    //   Everyone else — wipe by subject (their own generation scope).
    const unassignedDeleteWhere = isCasInjectingOther
      ? { scheduleId: id, subjectId: { in: subjectIds }, sectionId: { in: sectionIds } }
      : isCasAdmin && casClusterProgramIds
        ? { scheduleId: id, sectionId: { in: sectionIds } }
        : { scheduleId: id, subjectId: { in: subjectIds } }

    await db.scheduleEntry.deleteMany({ where: entryDeleteWhere })
    await db.unassignedEntry.deleteMany({ where: unassignedDeleteWhere })

    await db.scheduleEntry.createMany({ data: entryRows as any })

    if (result.unassigned.length > 0) {
      await db.unassignedEntry.createMany({
        data: result.unassigned.map(u => ({
          scheduleId: id,
          subjectId: u.subjectId,
          sectionId: u.sectionId,
          reason: u.reason,
        })),
      })
    }

    // Keep status as PENDING_APPROVAL after generation — Dept Chair still needs
    // to approve/reject before it becomes PUBLISHED.
    await db.schedule.update({
      where: { id },
      data: { generatedAt: new Date() },
    })

    const labCount = entryRows.filter(r => r.set !== null).length
    const assignedCount = result.assignments.length
    const notifMessage = result.unassigned.length > 0
      ? `${assignedCount} subject-sections scheduled (${entryRows.length} total entries, ${labCount} labs). ${result.unassigned.length} subject(s) could not be assigned and appear in the Unassigned Queue.`
      : `Backtracking algorithm completed. ${assignedCount} subject-sections scheduled (${entryRows.length} total entries, ${labCount} labs).`

    await createNotification({
      userId: dbUser.id,
      title: "Schedule Generated",
      message: notifMessage,
      type: "schedule_generated",
      link: "/dashboard/schedules",
    })

    // Back-fill specializations for every faculty that received assignments
    const assignedFacultyIds = [...new Set(entryRows.map((e: any) => e.facultyId).filter(Boolean))]
    await Promise.all(assignedFacultyIds.map((fid: string) => syncFacultySpecializations(fid).catch(() => {})))

    return NextResponse.json(
      apiResponse({
        entriesGenerated: entryRows.length,
        unassignedCount: result.unassigned.length,
        generatedAt: new Date().toISOString(),
      })
    )
  } catch (error: any) {
    console.error("POST /api/schedules/[id]/generate error:", error)

    if (error.name === "SchedulingError") {
      let details = error.details ?? []
      if (details.length > 10) {
        const specIssues = details.filter((d: string) =>
          d.includes("No faculty specializations match")
        )
        const roomIssues = details.filter((d: string) =>
          d.includes("No rooms match required type") || d.includes("No rooms with lab specialization")
        )
        const buildingIssues = details.filter((d: string) =>
          d.includes("building availability")
        )
        const otherIssues = details.filter(
          (d: string) =>
            !d.includes("No faculty specializations match") &&
            !d.includes("No rooms match required type") &&
            !d.includes("No rooms with lab specialization") &&
            !d.includes("building availability")
        )
        const summary: string[] = []
        if (specIssues.length > 0) {
          summary.push(
            `${specIssues.length} subjects have no faculty with matching specializations. Update faculty specializations in the Faculty page.`
          )
        }
        if (roomIssues.length > 0) {
          summary.push(
            `${roomIssues.length} subjects have no compatible rooms. Check room types and lab specializations in Buildings / Rooms.`
          )
        }
        if (buildingIssues.length > 0) {
          summary.push(
            `${buildingIssues.length} subjects could not be placed due to building availability restrictions. Ensure faculty have buildings marked as available.`
          )
        }
        summary.push(...otherIssues)
        details = summary
      }
      return NextResponse.json(
        { success: false, error: error.message, details },
        { status: 422 }
      )
    }

    return NextResponse.json(apiError("Internal server error"), { status: 500 })
  }
}
