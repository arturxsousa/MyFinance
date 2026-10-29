"use client";

import { Suspense, use } from "react";

interface AdminOnlyProps {
  /** Resolved on the server from the session; only this subtree waits for it */
  isAdmin: Promise<boolean>;
  children: React.ReactNode;
}

/**
 * Renders children only for Admins. Display only — access to /admin is
 * enforced server-side by the proxy and the page/route guards.
 */
export function AdminOnly({ isAdmin, children }: AdminOnlyProps) {
  return (
    <Suspense fallback={null}>
      <Gate isAdmin={isAdmin}>{children}</Gate>
    </Suspense>
  );
}

function Gate({ isAdmin, children }: AdminOnlyProps) {
  return use(isAdmin) ? children : null;
}
