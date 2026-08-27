import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, deleteSession } from "@/lib/session"

export async function POST() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  await deleteSession(token)
  store.delete(SESSION_COOKIE_NAME)
  return NextResponse.json({ success: true })
}
