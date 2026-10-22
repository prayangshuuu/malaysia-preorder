import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";

/**
 * Returns safe profile data for the authenticated session.
 * Does NOT expose password hashes, internal secrets, or other users' data.
 */
export async function GET() {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized", message: "You are not signed in." },
      { status: 401 }
    );
  }

  return NextResponse.json({
    user: {
      id: session.userId,
      email: session.email,
      name: session.name,
      role: session.role,
    },
  });
}
