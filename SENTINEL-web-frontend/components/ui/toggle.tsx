"use client";

import * as React from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const toggleVariants = cva(
  "inline-flex items-center justify-center rounded-sm text-[11px] font-medium whitespace-nowrap text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-brand data-[state=on]:text-brand-foreground data-[state=on]:font-semibold",
  {
    variants: {
      variant: { default: "bg-transparent" },
      size: { default: "h-7 px-2.5" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
