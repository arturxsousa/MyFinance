"use client";

import { AuthProvider } from "@/lib/auth-context";
import { FinanceProvider } from "@/lib/finance-context";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <FinanceProvider>{children}</FinanceProvider>
    </AuthProvider>
  );
}
