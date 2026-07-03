import { db } from "@/lib/db"

/**
 * Recomputes a faculty member's specializations and sectionCounts from their
 * actual schedule entries (across all schedules in any status).
 * Called whenever an entry is created, updated, or deleted.
 */
export async function syncFacultySpecializations(facultyId: string): Promise<void> {
  if (!facultyId) return

  const entries = await db.scheduleEntry.findMany({
    where: { facultyId },
    select: {
      sectionId: true,
      subject: { select: { title: true } },
    },
  })

  // subject title → Set of distinct sectionIds
  const map = new Map<string, Set<string>>()
  for (const e of entries) {
    const title = e.subject?.title
    if (!title) continue
    if (!map.has(title)) map.set(title, new Set())
    map.get(title)!.add(e.sectionId)
  }

  const specializations = Array.from(map.keys()).sort()
  const sectionCounts: Record<string, number> = {}
  for (const [title, sections] of map) {
    sectionCounts[title] = sections.size
  }

  await db.faculty.update({
    where: { id: facultyId },
    data: { specializations, sectionCounts },
  })
}
