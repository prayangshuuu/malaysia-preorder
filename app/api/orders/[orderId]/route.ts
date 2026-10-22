import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { assertResourceOwnership, AuthorizationError, isAdminOrStaffRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import {
  sanitizeCustomerOrder,
  updateOrderStatusSchema,
  updateOrderStateByAdmin,
  OrderServiceError,
  InvalidStatusTransitionError,
} from "@/lib/orders";

/**
 * GET /api/orders/[orderId]
 * Secure endpoint retrieving complete order tracking details.
 * Prevents IDOR by asserting ownership or administrative role.
 * Customer responses are sanitized to strip confidential costs/admin notes.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await context.params;

  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required." },
        { status: 401 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        lineItems: true,
        events: {
          orderBy: { createdAt: "desc" },
        },
        statusHistory: {
          orderBy: { createdAt: "desc" },
        },
        quote: {
          select: {
            id: true,
            quoteNumber: true,
            version: true,
            totalAmountBDT: true,
            shippingMethod: true,
            estDeliveryDaysMin: true,
            estDeliveryDaysMax: true,
            estDispatchDaysMin: true,
            estDispatchDaysMax: true,
            validUntil: true,
          },
        },
        payments: {
          select: {
            id: true,
            paymentNumber: true,
            amount: true,
            currency: true,
            method: true,
            status: true,
            providerTrxId: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        shipments: {
          include: {
            events: {
              orderBy: { timestamp: "desc" },
            },
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Not Found", message: "Order not found." },
        { status: 404 }
      );
    }

    // IDOR Protection: Must be the owning customer or internal staff
    await assertResourceOwnership(order.customerId, {
      errorMessage: "Cross-customer access denied. You do not own this order.",
    });

    const isStaff = isAdminOrStaffRole(session.role);

    // If staff, return complete data including admin notes
    if (isStaff) {
      return NextResponse.json({ order });
    }

    // If customer, sanitize and exclude private supplier costs and staff notes
    const customerSafeOrder = sanitizeCustomerOrder(order);
    return NextResponse.json({ order: customerSafeOrder });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: "Forbidden", message: err.message },
        { status: err.statusCode }
      );
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * PATCH /api/orders/[orderId]
 * Allows admin/staff to update order status, procurement, or shipment
 * within verified state transition rules. Appends audit log and event record.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await context.params;

  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required." },
        { status: 401 }
      );
    }

    if (!isAdminOrStaffRole(session.role)) {
      return NextResponse.json(
        { error: "Forbidden", message: "Only staff members can update order state." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updateOrderStatusSchema.safeParse({
      ...body,
      orderId,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation Error",
          message: "Invalid status transition request",
          details: parsed.error.format(),
        },
        { status: 400 }
      );
    }

    const updatedOrder = await updateOrderStateByAdmin(parsed.data, {
      id: session.userId,
      email: session.email,
      role: session.role,
    });

    return NextResponse.json({
      success: true,
      order: updatedOrder,
    });
  } catch (err: unknown) {
    if (err instanceof InvalidStatusTransitionError) {
      return NextResponse.json(
        { error: "Invalid Transition", message: err.message },
        { status: 422 }
      );
    }
    if (err instanceof OrderServiceError) {
      return NextResponse.json(
        { error: "Order Update Error", message: err.message },
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
