import { Suspense } from "react";
import { withUserDb } from "@/db/with-user-db";
import { userRepo } from "@/db/repositories/users";
import { requireUserPage } from "@/lib/guards";
import { toProfile } from "@/lib/profile";
import { Card, CardContent } from "@/components/ui/card";
import { ProfileForm } from "./profile-form";

export default function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your profile and preferences.</p>
      </div>

      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileSection />
      </Suspense>
    </div>
  );
}

async function ProfileSection() {
  const { userId } = await requireUserPage();
  const user = await withUserDb(userId, (tx) => userRepo.findById(tx, userId));
  if (!user) return null;
  return <ProfileForm profile={toProfile(user)} />;
}

function ProfileSkeleton() {
  return (
    <Card className="shadow-lg border-border/60">
      <CardContent className="pt-6 pb-6 space-y-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-9 rounded-md bg-muted animate-pulse" />
        ))}
      </CardContent>
    </Card>
  );
}
