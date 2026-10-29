import type { appUser } from "@/db/schema/users";

/** The user fields safe to send to the client — never the hash or lockout state. */
export function toProfile(user: typeof appUser.$inferSelect) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    currency: user.currency,
    locale: user.locale,
    timezone: user.timezone,
  };
}

export type Profile = ReturnType<typeof toProfile>;
