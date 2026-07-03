# iSched — Claude Code Project Instructions

## Project Overview

**iSched: A Web-Based Scheduling Management System With Constraint-Based Assignment Using Backtracking Algorithm**
Southern Luzon State University – Lucban Campus
Researchers: Gunay, Cherry Rose D. · Hernandez, Norilyn E. · Orbeta, Ramielle Antonette R.

This is a capstone project. All features must satisfy the panelist compliance requirements documented in the project's Compliance Report.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router (`"use client"` pages) |
| Database ORM | Prisma v7 with PrismaPg adapter |
| Prisma client output | `./prisma/generated/prisma/client/client` — always import from here |
| Auth | Supabase Auth (password, Google OAuth, magic link OTP) |
| Data fetching | TanStack Query (React Query v5) |
| UI | shadcn/ui + Tailwind CSS |
| Brand colors | Green `#1B4332`, Gold `#D4AF37` |

---

## Role Mapping (Critical — Compliance Requirement)

The panelist required a strict workflow hierarchy. The role names in the DB do **not** match the UI labels:

| DB Role | Real-world title | Capabilities |
|---|---|---|
| `SUPER_ADMIN` | **Department Head (CAS)** | Approves / rejects schedules, sees all colleges, manages system |
| `ADMIN` | **Program Chairperson** | Inputs data (faculty, subjects, availability), submits schedule for review |
| `FACULTY` | Faculty member | Read-only view of own schedule via magic-link login |

### Organizational Structure at SLSU-Lucban

**SUPER_ADMINs = CAS Department Heads** — all linked to the single `CAS` department in the DB.
- All GEC/GEL subjects live in the `CAS` department (no SS/LLH/MNS sub-departments).
- CAS programs (BAComm, BAHist, BSBio, BSMath, BAPsych) also live in the `CAS` department.
- Multiple SUPER_ADMIN users can share the same `CAS` departmentId — they all manage the same pool.

**NSTP and PATHFit are NOT auto-generated** by any dept chair — manually scheduled only.

Each CAS Department Head's `User.departmentId` must point to the `CAS` parent department. Use `getUserDepartmentId()` from `lib/auth.ts` to read it (checks `User.departmentId` first).

**ADMINs = Program Chairpersons** from all colleges (e.g., CIT, CAG). They manage major subjects only — GEC is handled by the dept chairs. Automatically locked to their own college.

### Scheduling Workflow (Step-by-step)
1. **Dept Chair (SUPER_ADMIN)**: Initializes schedule framework, sets room availability.
2. **Program Chair (ADMIN)**: Generates/manually adds major subjects → submits for review.
3. **Dept Chair (SUPER_ADMIN)**: Reviews submitted major schedules → generates their GEC/minor subjects for ALL sections university-wide. **Blocked until at least one ADMIN schedule is `PENDING_APPROVAL` or `PUBLISHED`.**

> **Compliance rule:** Program Chairperson (ADMIN) must submit before Department Head (SUPER_ADMIN) can generate GEC. This is enforced in `POST /api/schedules/[id]/generate` — never bypass it.

---

## Architecture Pillars

### 1. Multi-College / Per-College Isolation
- `College → Department → Program → YearLevel → Section` hierarchy
- Two primary colleges: **CAS** (managed by the 3 CAS Dept Heads / SUPER_ADMINs) and **CIT** (and other colleges, managed by their Program Chairs / ADMINs)
- `CollegeContext` (`lib/college-context.tsx`) provides `selectedCollegeId` globally
- All data-fetching hooks and API routes **must** accept and apply `collegeId` as a filter
- Non-SUPER_ADMIN users (Program Chairs, Faculty) are **locked to their own college** automatically
- SUPER_ADMIN (CAS Dept Heads) can switch colleges via the topbar filter; `null` = "All Colleges"

### 2. Lab Specialization
- `LabSpecialization` enum on `Room.labSpecialization` and `Subject.requiredLabSpecialization`
- Scheduling engine checks this as a **hard constraint** in `initializeCandidates()` before backtracking
- UI: LabInventory component (`components/rooms/lab-inventory.tsx`) with `LAB_SPEC_META`

### 3. Schedule Workflow State Machine
```
DRAFT  ──(ADMIN submits)──►  PENDING_APPROVAL  ──(SUPER_ADMIN approves)──►  PUBLISHED
                                                ──(SUPER_ADMIN rejects) ──►  DRAFT
```
- Route: `POST /api/schedules/[id]/workflow` with `{ action: "submit"|"approve"|"reject" }`
- `submit` is **ADMIN-only**; `approve`/`reject` are **SUPER_ADMIN-only**
- SUPER_ADMIN generation is **gated** — requires at least one ADMIN schedule in `PENDING_APPROVAL` or `PUBLISHED`
- ADMIN generation runs on `DRAFT` status only, no pre-gate on SUPER_ADMIN having run first
- UI: `components/schedule/workflow-actions.tsx`

### 4. Building Department Restrictions
- `DepartmentBuilding` junction table: `@@unique([departmentId, buildingId])`
- Buildings can be restricted to specific departments (zero entries = unrestricted)
- UI badge on building cards shows the restriction (lock icon + dept abbreviations)
- API: `GET/POST/PATCH /api/buildings` handles `restrictedDepartmentIds[]`

---

## Key API Routes

| Route | Method | Description |
|---|---|---|
| `/api/faculty` | GET | Accepts `departmentId` or `collegeId` filter |
| `/api/faculty` | POST | Creates faculty; email optional (stub vs. real auth user) |
| `/api/faculty/availability` | GET/POST | Faculty time availability (requires active `semesterId`) |
| `/api/auth/verify-faculty-email` | POST | Pre-OTP gate before Supabase magic link |
| `/api/schedules/[id]/workflow` | POST | State transitions (submit / approve / reject) |
| `/api/schedules/[id]/generate` | POST | Runs backtracking scheduler (requires PENDING_APPROVAL) |
| `/api/buildings` | GET/POST/PATCH | Includes `departments` relation; accepts `restrictedDepartmentIds` |
| `/api/semesters` | GET | Returns all semesters including `academicYear`; `isActive` marks the current one |

---

## Semester Handling

- `Semester.isActive = true` marks the active semester for scheduling
- If no semester is marked active, the system auto-falls back to the most recent semester (ordered by `academicYear.startYear DESC`)
- Faculty availability is always stored with a `semesterId` — the active semester is auto-selected silently (no dropdown shown to the user)

---

## Auth & Security Rules

- **Never** expose `SUPABASE_SERVICE_ROLE_KEY` in `NEXT_PUBLIC_*` variables
- Admin client: `lib/supabase/admin.ts` — server-only, never import in client components
- `.env` must stay in `.gitignore` — never commit it
- Stub faculty users have `supabaseId` starting with `"manual-"` — they cannot use magic link login
- Faculty with a real email get a Supabase auth account created with `email_confirm: true`

---

## Faculty Availability Page Notes

- Semester dropdown was intentionally removed — active semester is auto-selected
- The `Add Faculty` button in the availability page creates faculty records (with optional email for magic-link access)
- `useFacultyList` now accepts `{ collegeId? }` — always pass `selectedCollegeId` from `useCollege()` so only the selected college's faculty appear

---

## Compliance Checklist (Panelist Requirements — All Implemented)

| Requirement | Feature | Location |
|---|---|---|
| CIT + all departments scheduling | Multi-college architecture | `CollegeContext`, `/api/faculty?collegeId=` |
| All labs integrated | Room types: LABORATORY, COMPUTER_LAB, LECTURE_LAB | Prisma schema, rooms page |
| Labs categorized by academic specialization | `LabSpecialization` enum | `components/rooms/lab-inventory.tsx` |
| Per-college data organization | `selectedCollegeId` filter on all pages | `lib/college-context.tsx` |
| Program Chair inputs first → Dept Chair approves | Workflow state machine | `/api/schedules/[id]/workflow` |

---

## Prisma Notes

- Always import from `./prisma/generated/prisma/client/client` (custom output path)
- Run migrations via `npx prisma migrate dev`
- Seed scripts are in `prisma/` (e.g., `prisma/seed-subjects.ts`) — run with `npx tsx prisma/<file>.ts`
