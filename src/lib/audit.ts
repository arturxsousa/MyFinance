import { auditLog } from "@/db/schema/users";
import type { UserTx } from "@/db/with-user-db";

interface AuditParams {
  tx: UserTx;
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

export async function writeAuditLog({
  tx,
  actorId,
  action,
  targetType,
  targetId,
  metadata,
  ip,
}: AuditParams) {
  await tx.insert(auditLog).values({
    actorId: actorId ?? null,
    action,
    targetType: targetType ?? null,
    targetId: targetId ?? null,
    metadata: metadata ? JSON.stringify(metadata) : null,
    ip: ip ?? null,
  });
}
