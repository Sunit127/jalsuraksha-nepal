"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, History } from "lucide-react";
import { readMySos, type MySos } from "@/lib/utilities/my-sos";
import { timeAgo } from "@/lib/utilities/format";

/** Quick links back to SOS requests sent from this device (last 24 h). */
export function MySosList() {
  const [items, setItems] = useState<MySos[]>([]);
  useEffect(() => {
    const dayAgo = Date.now() - 86_400_000;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read browser-only storage after mount
    setItems(readMySos().filter((s) => new Date(s.createdAt).getTime() > dayAgo));
  }, []);
  if (items.length === 0) return null;

  return (
    <section className="rounded-2xl border bg-card p-3">
      <p className="label-caps flex items-center gap-1.5 text-muted-foreground">
        <History className="size-3.5" aria-hidden /> Your recent SOS
      </p>
      <ul className="mt-2 grid gap-1">
        {items.map((s) => (
          <li key={s.ref}>
            <Link
              href={`/citizen/sos/${s.ref}?t=${s.token}`}
              className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-accent"
            >
              <span className="font-semibold tabular">{s.ref}</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {timeAgo(s.createdAt)} · Track <ChevronRight className="size-3.5" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
