import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { AuthorizationError } from "@/lib/auth/rbac";
import { rejectQuote, QuoteServiceError } from "@/lib/quotes/service";
import { quoteRejectSchema } from "@/lib/quotes/types";

/**
 * POST /api/quotes/[id]/reject
 * Customer quote rejection.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();

    const parsed = quoteRejectSchema.safeParse({
      ...body,
      quoteId: id,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const result = await rejectQuote(parsed.data, {
      id: session.userId,
      email: session.email,
      name: session.name || "Customer",
    });

    return NextResponse.json({
      message: "Quote declined.",
      quote: result,
    });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    if (err instanceof QuoteServiceError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    console.error("[POST /api/quotes/[id]/reject]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
