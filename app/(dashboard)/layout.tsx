import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { DashboardShell } from "@/components/layout/dashboard-shell"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = await auth()

  if (!userId) {
    redirect("/sign-in")
  }

  // In production, fetch user from DB to get role
  // For now, default to SUPER_ADMIN for development
  const userRole = "SUPER_ADMIN"
  const userName = "Admin User"
  const userEmail = "admin@slsu.edu.ph"

  return (
    <DashboardShell
      userRole={userRole}
      userName={userName}
      userEmail={userEmail}
    >
      {children}
    </DashboardShell>
  )
}
