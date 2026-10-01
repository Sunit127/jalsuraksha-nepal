import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfileView } from "@/components/shared/profile-view";
import { getSessionContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const session = await getSessionContext();
  if (!session.userId || session.isAnonymous) redirect("/auth/login?next=/citizen/profile");
  return <ProfileView profile={session.profile} email={session.email} />;
}
