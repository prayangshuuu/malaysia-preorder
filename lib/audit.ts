import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface LogAuditOptions {
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Log an auditable staff/admin action safely to the database.
 * Never stores raw credentials, credit cards, or secret keys.
 */
export async function logAudit(options: LogAuditOptions): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: options.actorId ?? null,
        actorEmail: options.actorEmail ?? null,
        actorRole: options.actorRole ?? null,
        action: options.action,
        entityType: options.entityType,
        entityId: options.entityId ?? null,
        metadata: options.metadata ?? Prisma.JsonNull,
        ipAddress: options.ipAddress ?? null,
        userAgent: options.userAgent ?? null,
      },
    });
  } catch (error) {
    // Audit logging failure should not completely crash operations, but should log loudly in console
    console.error("[AuditLog Error] Failed to persist audit entry:", error);
  }
}
