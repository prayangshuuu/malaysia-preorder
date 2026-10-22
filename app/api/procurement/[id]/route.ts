import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { isAdminOrStaffRole } from "@/lib/auth/rbac";
import {
  updateProcurementStatusSchema,
  updateProcurementStatus,
  ProcurementShipmentError,
} from "@/lib/procurement-shipment";
import { InvalidStatusTransitionError } from "@/lib/orders";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session || !isAdminOrStaffRole(session.role)) {
      return NextResponse.json({ error: "Forbidden: Staff only" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateProcurementStatusSchema.safeParse({
      ...body,
      procurementId: id,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation Error", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await updateProcurementStatus(parsed.data, {
      id: session.userId,
      email: session.email,
      role: session.role,
    });

    return NextResponse.json({ success: true, procurement: updated });
  } catch (err: unknown) {
    if (err instanceof InvalidStatusTransitionError) {
      return NextResponse.json({ error: "Invalid Transition", message: err.message }, { status: 422 });
    }
    if (err instanceof ProcurementShipmentError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
