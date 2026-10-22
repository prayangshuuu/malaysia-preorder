import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { isAdminOrStaffRole } from "@/lib/auth/rbac";
import {
  addOrderTimelineEventSchema,
  addOrderTimelineEvent,
  ProcurementShipmentError,
} from "@/lib/procurement-shipment";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session || !isAdminOrStaffRole(session.role)) {
      return NextResponse.json({ error: "Forbidden: Staff only" }, { status: 403 });
    }

    const { orderId } = await context.params;
    const body = await request.json();
    const parsed = addOrderTimelineEventSchema.safeParse({
      ...body,
      orderId,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation Error", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const event = await addOrderTimelineEvent(parsed.data, {
      id: session.userId,
      email: session.email,
      role: session.role,
    });

    return NextResponse.json({ success: true, event }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof ProcurementShipmentError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
