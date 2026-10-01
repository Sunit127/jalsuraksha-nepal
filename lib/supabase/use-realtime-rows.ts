"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { getSupabaseBrowserClient, prepareRealtime } from "./client";
import { isSupabaseConfigured } from "./env";

type TableName = keyof Database["public"]["Tables"];
type Row<T extends TableName> = Database["public"]["Tables"][T]["Row"];

export type RealtimeState = "connecting" | "live" | "offline";

type HiddenListener = (table: string, id: string) => void;
const hiddenListeners = new Set<HiddenListener>();
let visibilityChannel: RealtimeChannel | null = null;

/**
 * postgres_changes never tells a citizen that a row stopped being public (the
 * new row fails RLS, so the UPDATE is not delivered). The database broadcasts
 * `{ table, id }` on `public:visibility` instead (migration 0007); one shared
 * channel fans it out to every subscribed list.
 */
function onRowHidden(listener: HiddenListener): () => void {
  const supabase = getSupabaseBrowserClient();
  hiddenListeners.add(listener);
  if (!visibilityChannel) {
    visibilityChannel = supabase
      .channel("public:visibility")
      .on("broadcast", { event: "hidden" }, ({ payload }) => {
        const { table, id } = (payload ?? {}) as { table?: string; id?: string };
        if (!table || !id) return;
        for (const l of hiddenListeners) l(table, id);
      })
      .subscribe();
  }
  return () => {
    hiddenListeners.delete(listener);
    if (hiddenListeners.size === 0 && visibilityChannel) {
      void supabase.removeChannel(visibilityChannel);
      visibilityChannel = null;
    }
  };
}

/**
 * Keeps a list of rows in sync with Supabase Realtime (postgres_changes).
 * Events are already filtered by RLS for the current user. Rows that stop
 * matching `keep` (e.g. resolved incidents on a filtered view) are dropped.
 *
 * `onSubscribed` fires every time the channel (re)joins. Events that happened
 * before the join — between the server fetch and the websocket connecting, or
 * while the connection was down — are never replayed, so callers use it to
 * re-fetch a fresh snapshot (see useResync).
 */
export function useRealtimeRows<T extends TableName>(
  table: T,
  initialRows: Row<T>[],
  options: {
    /** Postgres changes filter, e.g. "sos_id=eq.<uuid>". */
    filter?: string;
    keep?: (row: Row<T>) => boolean;
    onEvent?: (payload: RealtimePostgresChangesPayload<Row<T>>) => void;
    onSubscribed?: () => void;
    enabled?: boolean;
    /** Drop rows the database reports as no longer public (citizen views only). */
    dropOnHidden?: boolean;
  } = {},
) {
  const [rows, setRows] = useState<Row<T>[]>(initialRows);
  const [state, setState] = useState<RealtimeState>("connecting");
  const optsRef = useRef(options);
  useEffect(() => {
    optsRef.current = options;
  });

  // Re-seed when the server sends fresh data (e.g. after router.refresh()).
  const [seed, setSeed] = useState(initialRows);
  if (seed !== initialRows) {
    setSeed(initialRows);
    setRows(initialRows);
  }

  const { filter, enabled = true, dropOnHidden = false } = options;

  useEffect(() => {
    if (!enabled || !dropOnHidden || !isSupabaseConfigured()) return;
    return onRowHidden((hiddenTable, id) => {
      if (hiddenTable !== table) return;
      setRows((current) => current.filter((r) => (r as { id?: string }).id !== id));
    });
  }, [table, enabled, dropOnHidden]);

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowserClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void prepareRealtime().then(() => {
      if (cancelled) return;
      channel = supabase
        .channel(`rt:${table}:${filter ?? "all"}:${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes" as never,
          { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
          (payload: RealtimePostgresChangesPayload<Row<T>>) => {
            const keep = optsRef.current.keep ?? (() => true);
            setRows((current) => {
              const idOf = (r: unknown) => (r as { id?: string } | null)?.id;
              if (payload.eventType === "DELETE") {
                const id = idOf(payload.old);
                return current.filter((r) => idOf(r) !== id);
              }
              const next = payload.new as Row<T>;
              const id = idOf(next);
              const exists = current.some((r) => idOf(r) === id);
              if (!keep(next)) return current.filter((r) => idOf(r) !== id);
              return exists ? current.map((r) => (idOf(r) === id ? next : r)) : [next, ...current];
            });
            optsRef.current.onEvent?.(payload);
          },
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            setState("live");
            optsRef.current.onSubscribed?.();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            setState("offline");
          }
        });
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [table, filter, enabled]);

  return { rows, setRows, state };
}

/**
 * Debounced "fetch a fresh server snapshot" trigger. Call the returned
 * function from channel (re)subscriptions; it also fires when the tab becomes
 * visible again or the device comes back online (phones suspend websockets
 * when locked). Several channels joining at once cause a single refresh.
 */
export function useResync(delayMs = 400) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRun = useRef(0);

  const resync = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      // Avoid refresh storms (e.g. flapping connections).
      if (Date.now() - lastRun.current < 3000) return;
      lastRun.current = Date.now();
      router.refresh();
    }, delayMs);
  }, [router, delayMs]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") resync();
    };
    const onOnline = () => resync();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [resync]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return resync;
}
