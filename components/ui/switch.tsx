"use client";

import * as React from "react";
import { Switch as S } from "radix-ui";
import { cn } from "@/lib/utils";

export function Switch({ className, ...props }: React.ComponentProps<typeof S.Root>) {
  return (
    <S.Root
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-line-strong/60 transition-colors duration-200 data-[state=checked]:bg-green disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <S.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow transition-transform duration-200 data-[state=checked]:translate-x-[18px]" />
    </S.Root>
  );
}
