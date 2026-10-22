import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import {
  createOrderFromQuoteSchema,
  createOrderFromAcceptedQuote,
  OrderServiceError,
} from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import { isAdminOrStaffRole } from "@/lib/auth/rbac";
import { OrderStatus } from "@prisma/client";

/**
 * POST /api/orders
 * Creates an immutable order from an accepted quote.
 *
 * Security:
 * - Requires authenticated session
 * - Asserts quote ownership or admin/staff privileges
 * - Atomic database transaction with duplicate checks & snapshotting
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required to place an order." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = createOrderFromQuoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation Error",
          message: "Invalid order creation request",
          details: parsed.error.format(),
        },
        { status: 400 }
      );
    }

    const order = await createOrderFromAcceptedQuote(parsed.data, {
      id: session.userId,
      email: session.email,
      role: session.role,
    });

    return NextResponse.json(
      {
        success: true,
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmountBDT: order.totalAmountBDT,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (err instanceof OrderServiceError) {
      return NextResponse.json(
        { error: "Order Creation Failed", message: err.message },
        { status: err.statusCode }
      );
    }

    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/orders
 * Lists orders for the current user (or all orders for staff).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required." },
        { status: 401 }
      );
    }

    const isStaff = isAdminOrStaffRole(session.role);
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");

    const where: { customerId?: string; status?: OrderStatus } = {};
    if (!isStaff) {
      where.customerId = session.userId;
    }
    if (statusParam && Object.values(OrderStatus).includes(statusParam as OrderStatus)) {
      where.status = statusParam as OrderStatus;
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        customerId: true,
        status: true,
        paymentStatus: true,
        procurementStatus: true,
        shipmentStatus: true,
        currency: true,
        totalAmountBDT: true,
        paidAmountBDT: true,
        createdAt: true,
        _count: {
          select: { lineItems: true },
        },
        customer: isStaff
          ? {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            }
          : false,
      },
      take: 50,
    });

    return NextResponse.json({ orders });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
