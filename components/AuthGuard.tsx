"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import NavBar from "@/components/NavBar";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublicPage = pathname === "/login" || pathname === "/signup";

  useEffect(() => {
    if (!currentUser && !isPublicPage) {
      router.replace("/login");
    }
    if (currentUser && isPublicPage) {
      router.replace("/");
    }
  }, [currentUser, isPublicPage, router]);

  if (!currentUser && !isPublicPage) return null;

  return (
    <>
      {!isPublicPage && <NavBar />}
      {children}
    </>
  );
}
