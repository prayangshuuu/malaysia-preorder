import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { isAdminOrStaffRole } from "@/lib/auth/rbac";
import {
  createSupplierSchema,
  createSupplier,
  getSuppliers,
  ProcurementShipmentError,
} from "@/lib/procurement-shipment";

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session || !isAdminOrStaffRole(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const suppliers = await getSuppliers(false);
    return NextResponse.json({ suppliers });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session || !isAdminOrStaffRole(session.role)) {
      return NextResponse.json({ error: "Forbidden: Staff only" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createSupplierSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation Error", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const supplier = await createSupplier(parsed.data, {
      id: session.userId,
      email: session.email,
      role: session.role,
    });

    return NextResponse.json({ success: true, supplier }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof ProcurementShipmentError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
