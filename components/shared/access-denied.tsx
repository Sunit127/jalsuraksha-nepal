import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/auth/actions";
import { ROLE_LABEL, homeForRole } from "@/lib/auth/roles";
import type { AppRole } from "@/types/domain";

export function AccessDenied({
  area,
  role,
}: {
  area: string;
  role: AppRole | null;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="max-w-md text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-danger-soft text-danger-ink">
          <ShieldX className="size-7" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-semibold">Access restricted</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The {area} is only available to authorised emergency staff.
          {role && (
            <>
              {" "}You are signed in as <strong>{ROLE_LABEL[role]}</strong>.
            </>
          )}
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button asChild>
            <Link href={homeForRole(role)}>Go to my workspace</Link>
          </Button>
          <form action={signOut}>
            <Button type="submit" variant="outline" className="w-full">
              Sign in with another account
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
