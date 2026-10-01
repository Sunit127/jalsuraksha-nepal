import type { Metadata } from "next";
import { authorize } from "@/lib/auth/session";
import SheltersAdminPage from "./shelters-view";

export const metadata: Metadata = { title: "Shelter management" };

export default async function SheltersPage() {
  const auth = await authorize("dashboard");
  return <SheltersAdminPage isAdmin={auth.ok && auth.session.role === "admin"} />;
}
