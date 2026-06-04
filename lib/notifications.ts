import { db } from "@/lib/db"

export type NotificationType =
  | "schedule_published"
  | "schedule_generated"
  | "user_approved"
  | "user_registered"
  | "faculty_added"
  | "faculty_request"
  | "conflict_detected"
  | "workflow_submitted"
  | "workflow_approved"
  | "workflow_rejected"
  | "general"

export async function createNotification({
  userId,
  title,
  message,
  type,
  link,
}: {
  userId: string
  title: string
  message: string
  type: NotificationType
  link?: string
}) {
  return db.notification.create({
    data: { userId, title, message, type, link },
  })
}

export async function notifyAllSuperAdmins(title: string, message: string, type: NotificationType, link?: string) {
  const admins = await db.user.findMany({
    where: { role: "SUPER_ADMIN", isApproved: true, isActive: true },
    select: { id: true },
  })

  if (admins.length === 0) return

  await db.notification.createMany({
    data: admins.map((a) => ({
      userId: a.id,
      title,
      message,
      type,
      link,
    })),
  })
}
