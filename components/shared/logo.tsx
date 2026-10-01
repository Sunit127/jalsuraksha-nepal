import { cn } from "@/lib/utils";

/** JalSuraksha mark: a shield (suraksha) holding a water drop (jal). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("size-8 shrink-0", className)}
    >
      <path
        d="M16 2.5 4.5 6.8v8.1c0 7.3 4.9 12.9 11.5 14.6 6.6-1.7 11.5-7.3 11.5-14.6V6.8L16 2.5Z"
        fill="#0f2447"
      />
      <path
        d="M16 8.2c-2.9 3.6-5.3 6.8-5.3 9.6a5.3 5.3 0 0 0 10.6 0c0-2.8-2.4-6-5.3-9.6Z"
        fill="#38bdf8"
      />
      <path
        d="M13.4 18.4c.3 1.5 1.4 2.5 2.9 2.7"
        stroke="#e0f2fe"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function Logo({
  className,
  subtitle,
  inverted = false,
}: {
  className?: string;
  subtitle?: string;
  inverted?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "text-[15px] font-bold tracking-tight",
            inverted ? "text-white" : "text-foreground",
          )}
        >
          JalSuraksha <span className={inverted ? "text-sky-300" : "text-sky-700"}>Nepal</span>
        </span>
        {subtitle && (
          <span
            className={cn(
              "mt-0.5 text-[10px] font-medium uppercase tracking-[0.12em]",
              inverted ? "text-slate-300" : "text-muted-foreground",
            )}
          >
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );
}
