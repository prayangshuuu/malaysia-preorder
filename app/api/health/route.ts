import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/health
 * Production health and readiness endpoint.
 * Verifies runtime status and database connectivity safely.
 * Returns HTTP 200 on healthy; HTTP 503 on service degradation.
 */
export async function GET() {
  const timestamp = new Date().toISOString();
  let dbStatus = "healthy";
  let latencyMs = 0;

  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    latencyMs = Date.now() - start;
  } catch (error) {
    dbStatus = "unhealthy";
    console.error("[Health Check Error] Database ping failed:", error);
    return NextResponse.json(
      {
        status: "degraded",
        timestamp,
        services: {
          database: {
            status: "unhealthy",
            error: "Database connectivity check failed",
          },
          runtime: {
            status: "healthy",
            nodeVersion: process.version,
          },
        },
      },
      { status: 503 }
    );
  }

  return NextResponse.json(
    {
      status: "healthy",
      timestamp,
      services: {
        database: {
          status: dbStatus,
          latencyMs,
        },
        runtime: {
          status: "healthy",
          nodeVersion: process.version,
        },
      },
    },
    { status: 200 }
  );
}
