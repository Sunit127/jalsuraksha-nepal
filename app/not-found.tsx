import Link from "next/link";
import { MapPinOff } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <Logo />
      <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <MapPinOff className="size-6" aria-hidden />
      </span>
      <div>
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">The link may be outdated, or the incident no longer exists.</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild><Link href="/citizen">Citizen app</Link></Button>
        <Button asChild variant="outline"><Link href="/dashboard">Operations centre</Link></Button>
        <Button asChild variant="destructive"><Link href="/citizen/sos">Emergency SOS</Link></Button>
      </div>
    </div>
  );
}
