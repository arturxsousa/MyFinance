"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";

export type Role = "admin" | "user";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  joined: string;
  status: "Active" | "Inactive";
};

type Result = { success: boolean; error?: string };

type AuthContextType = {
  currentUser: User | null;
  users: User[];
  loading: boolean;
  login: (email: string, password: string) => Promise<Result>;
  logout: () => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<Result>;
  updateAccount: (fields: { name: string; email: string; password?: string }) => Promise<Result>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(id: string, email: string): Promise<User | null> {
    const { data } = await supabase.from("profiles").select("*").eq("id", id).single();
    if (!data) return null;
    return { id, email, name: data.name, role: data.role, joined: data.joined, status: data.status };
  }

  async function fetchAllUsers() {
    const { data } = await supabase.from("profiles").select("*").order("joined");
    if (!data) return;
    setUsers(data.map((p: { id: string; name: string; role: Role; joined: string; status: "Active" | "Inactive"; email: string }) => ({
      id: p.id,
      name: p.name,
      email: p.email ?? "",
      role: p.role,
      joined: p.joined,
      status: p.status,
    })));
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const profile = await fetchProfile(session.user.id, session.user.email ?? "");
        setCurrentUser(profile);
        if (profile?.role === "admin") await fetchAllUsers();
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "USER_UPDATED") return;
      if (session) {
        const profile = await fetchProfile(session.user.id, session.user.email ?? "");
        setCurrentUser(profile);
        if (profile?.role === "admin") await fetchAllUsers();
      } else {
        setCurrentUser(null);
        setUsers([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function login(email: string, password: string): Promise<Result> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: "Invalid email or password." };
    return { success: true };
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  async function signUp(name: string, email: string, password: string): Promise<Result> {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { success: false, error: error.message };
    if (!data.user) return { success: false, error: "Sign up failed." };

    const { error: profileError } = await supabase.from("profiles").insert({
      id: data.user.id,
      name,
      email,
      role: "user",
      status: "Active",
      joined: new Date().toISOString().split("T")[0],
    });

    if (profileError) return { success: false, error: profileError.message };
    return { success: true };
  }

  async function updateAccount(fields: { name: string; email: string; password?: string }): Promise<Result> {
    if (!currentUser) return { success: false, error: "Not logged in." };

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ name: fields.name })
      .eq("id", currentUser.id);

    if (profileError) return { success: false, error: profileError.message };

    if (fields.password) {
      const { error } = await supabase.auth.updateUser({ password: fields.password });
      if (error) return { success: false, error: error.message };
    }

    setCurrentUser((prev) => prev ? { ...prev, name: fields.name } : prev);
    return { success: true };
  }

  return (
    <AuthContext.Provider value={{ currentUser, users, loading, login, logout, signUp, updateAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
