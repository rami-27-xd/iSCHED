import { auth, currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { DashboardShell } from "@/components/layout/dashboard-shell"
import { db } from "@/lib/db"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId: clerkId } = await auth()

  if (!clerkId) {
    redirect("/sign-in")
  }

  // Try to get user from DB
  let userRole = "SUPER_ADMIN"
  let userName = "User"
  let userEmail = ""

  try {
    const dbUser = await db.user.findUnique({
      where: { clerkId },
    })

    if (dbUser) {
      userRole = dbUser.role
      userName = `${dbUser.firstName} ${dbUser.lastName}`.trim() || "User"
      userEmail = dbUser.email
    } else {
      // Fallback to Clerk user data
      const clerkUser = await currentUser()
      if (clerkUser) {
        userName = `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() || "User"
        userEmail = clerkUser.emailAddresses?.[0]?.emailAddress ?? ""
        userRole = (clerkUser.publicMetadata?.role as string) ?? "SUPER_ADMIN"
      }
    }
  } catch {
    // DB not connected yet — use Clerk data
    const clerkUser = await currentUser()
    if (clerkUser) {
      userName = `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() || "User"
      userEmail = clerkUser.emailAddresses?.[0]?.emailAddress ?? ""
      userRole = (clerkUser.publicMetadata?.role as string) ?? "SUPER_ADMIN"
    }
  }

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
