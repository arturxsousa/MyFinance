"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import NavBar from "@/components/NavBar";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { currentUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublicPage = pathname === "/login" || pathname === "/signup";

  useEffect(() => {
    if (loading) return;
    if (!currentUser && !isPublicPage) router.replace("/login");
    if (currentUser && isPublicPage) router.replace("/");
  }, [currentUser, loading, isPublicPage, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!currentUser && !isPublicPage) return null;

  return (
    <>
      {!isPublicPage && <NavBar />}
      {children}
    </>
  );
}
