"use client";

import { createContext, useContext, useState } from "react";

export type Role = "admin" | "user";

export type User = {
  id: number;
  name: string;
  email: string;
  role: Role;
  joined: string;
  status: "Active" | "Inactive";
};

type StoredUser = User & { password: string };

const defaultUsers: StoredUser[] = [
  { id: 1, name: "Admin",       email: "admin@finance.app", password: "Admin@2026!", role: "admin", status: "Active",   joined: "2026-01-01" },
  { id: 2, name: "Artur Sousa", email: "artur@finance.app", password: "user1234",    role: "user",  status: "Active",   joined: "2026-01-15" },
  { id: 3, name: "Maria Silva", email: "maria@finance.app", password: "user1234",    role: "user",  status: "Active",   joined: "2026-02-03" },
  { id: 4, name: "João Costa",  email: "joao@finance.app",  password: "user1234",    role: "user",  status: "Inactive", joined: "2026-01-20" },
];

function loadUsers(): StoredUser[] {
  if (typeof window === "undefined") return defaultUsers;
  const stored = localStorage.getItem("users");
  return stored ? JSON.parse(stored) : defaultUsers;
}

function saveUsers(users: StoredUser[]) {
  localStorage.setItem("users", JSON.stringify(users));
}

type AuthContextType = {
  currentUser: User | null;
  users: User[];
  login: (email: string, password: string) => boolean;
  logout: () => void;
  signUp: (name: string, email: string, password: string) => { success: boolean; error?: string };
  updateAccount: (fields: { name: string; email: string; password?: string }) => { success: boolean; error?: string };
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [storedUsers, setStoredUsers] = useState<StoredUser[]>(loadUsers);

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem("currentUser");
    return stored ? JSON.parse(stored) : null;
  });

  const users: User[] = storedUsers.map(({ password: _, ...u }) => u);

  function login(email: string, password: string): boolean {
    const match = storedUsers.find((u) => u.email === email && u.password === password);
    if (!match) return false;
    const { password: _, ...user } = match;
    setCurrentUser(user);
    localStorage.setItem("currentUser", JSON.stringify(user));
    return true;
  }

  function logout() {
    setCurrentUser(null);
    localStorage.removeItem("currentUser");
  }

  function signUp(name: string, email: string, password: string): { success: boolean; error?: string } {
    if (storedUsers.find((u) => u.email === email)) {
      return { success: false, error: "An account with this email already exists." };
    }
    const newUser: StoredUser = {
      id: Date.now(),
      name,
      email,
      password,
      role: "user",
      status: "Active",
      joined: new Date().toISOString().split("T")[0],
    };
    const updated = [...storedUsers, newUser];
    setStoredUsers(updated);
    saveUsers(updated);
    return { success: true };
  }

  function updateAccount(fields: { name: string; email: string; password?: string }): { success: boolean; error?: string } {
    if (!currentUser) return { success: false, error: "Not logged in." };
    const emailTaken = storedUsers.find((u) => u.email === fields.email && u.id !== currentUser.id);
    if (emailTaken) return { success: false, error: "Email is already in use." };
    const updated = storedUsers.map((u) =>
      u.id === currentUser.id
        ? { ...u, name: fields.name, email: fields.email, ...(fields.password ? { password: fields.password } : {}) }
        : u
    );
    setStoredUsers(updated);
    saveUsers(updated);
    const updatedUser = { ...currentUser, name: fields.name, email: fields.email };
    setCurrentUser(updatedUser);
    localStorage.setItem("currentUser", JSON.stringify(updatedUser));
    return { success: true };
  }

  return (
    <AuthContext.Provider value={{ currentUser, users, login, logout, signUp, updateAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
