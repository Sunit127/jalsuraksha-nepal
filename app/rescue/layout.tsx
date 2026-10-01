import type { Metadata } from "next";
import { AccessDenied } from "@/components/shared/access-denied";
import { requireArea } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Rescue Team Console" };

export default async function RescueLayout({ children }: LayoutProps<"/rescue">) {
  const auth = await requireArea("rescue", "/rescue");
  if (!auth.ok) return <AccessDenied area="rescue team console" role={auth.session.role} />;
  return <>{children}</>;
}
