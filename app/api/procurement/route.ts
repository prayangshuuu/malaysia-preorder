import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { isAdminOrStaffRole } from "@/lib/auth/rbac";
import {
  recordProcurementSchema,
  recordProcurement,
  ProcurementShipmentError,
} from "@/lib/procurement-shipment";
import { InvalidStatusTransitionError } from "@/lib/orders";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session || !isAdminOrStaffRole(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");

    const records = await prisma.procurementRecord.findMany({
      where: orderId ? { orderId } : undefined,
      include: {
        supplier: true,
        orderLineItem: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ records });
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
    const parsed = recordProcurementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation Error", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const record = await recordProcurement(parsed.data, {
      id: session.userId,
      email: session.email,
      role: session.role,
    });

    return NextResponse.json({ success: true, record }, { status: 201 });
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
