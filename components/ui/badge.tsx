import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide [&>svg]:size-3 [&>svg]:pointer-events-none",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "text-foreground",
        safe: "border-safe/30 bg-safe-soft text-safe-ink",
        watch: "border-watch/40 bg-watch-soft text-watch-ink",
        high: "border-high/40 bg-high-soft text-high-ink",
        danger: "border-danger/30 bg-danger-soft text-danger-ink",
        info: "border-info/30 bg-info-soft text-info-ink",
        solidDanger: "border-transparent bg-danger text-white",
        demo: "border-dashed border-muted-foreground/40 bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";
  return <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
