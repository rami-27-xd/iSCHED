import { Webhook } from "svix"
import { headers } from "next/headers"
import { db } from "@/lib/db"
import type { WebhookEvent } from "@clerk/nextjs/server"

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    throw new Error("CLERK_WEBHOOK_SECRET is not set in environment variables")
  }

  const headerPayload = await headers()
  const svix_id = headerPayload.get("svix-id")
  const svix_timestamp = headerPayload.get("svix-timestamp")
  const svix_signature = headerPayload.get("svix-signature")

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 })
  }

  const payload = await req.json()
  const body = JSON.stringify(payload)

  const wh = new Webhook(WEBHOOK_SECRET)
  let event: WebhookEvent

  try {
    event = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error("Webhook verification failed:", err)
    return new Response("Invalid signature", { status: 400 })
  }

  const eventType = event.type

  if (eventType === "user.created" || eventType === "user.updated") {
    const { id, email_addresses, first_name, last_name, public_metadata } =
      event.data

    const email = email_addresses?.[0]?.email_address
    if (!email) {
      return new Response("No email found", { status: 400 })
    }

    const role =
      (public_metadata?.role as string) ?? "STUDENT"

    await db.user.upsert({
      where: { clerkId: id },
      create: {
        clerkId: id,
        email,
        firstName: first_name ?? "",
        lastName: last_name ?? "",
        role: role as any,
      },
      update: {
        email,
        firstName: first_name ?? "",
        lastName: last_name ?? "",
        role: role as any,
      },
    })
  }

  if (eventType === "user.deleted") {
    const { id } = event.data
    if (id) {
      await db.user.update({
        where: { clerkId: id },
        data: { isActive: false },
      }).catch(() => {
        // User might not exist in our DB
      })
    }
  }

  return new Response(null, { status: 200 })
}
