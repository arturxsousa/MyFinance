"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const roleBadge: Record<string, string> = {
  admin: "bg-violet-900 text-violet-300",
  user:  "bg-gray-700 text-gray-300",
};

const statusBadge: Record<string, string> = {
  Active:   "bg-emerald-900 text-emerald-300",
  Inactive: "bg-rose-900 text-rose-300",
};

export default function AdminPage() {
  const { currentUser, users } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (currentUser && currentUser.role !== "admin") router.replace("/");
  }, [currentUser, router]);

  if (!currentUser || currentUser.role !== "admin") return null;

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-2">User Management</h1>
      <p className="text-gray-400 text-sm mb-8">All registered users in the system.</p>

      <div className="bg-gray-900 rounded-xl shadow-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 uppercase text-xs tracking-wider">
              <th className="text-left px-6 py-4">Name</th>
              <th className="text-left px-6 py-4">Email</th>
              <th className="text-left px-6 py-4">Role</th>
              <th className="text-left px-6 py-4">Status</th>
              <th className="text-right px-6 py-4">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800 transition-colors">
                <td className="px-6 py-4 font-medium text-white">{user.name}</td>
                <td className="px-6 py-4 text-gray-400">{user.email}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-md text-xs font-medium capitalize ${roleBadge[user.role]}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-md text-xs font-medium ${statusBadge[user.status]}`}>
                    {user.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-gray-400">{user.joined}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
