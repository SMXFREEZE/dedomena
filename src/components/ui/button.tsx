"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: "default" | "glass" | "ghost" | "danger" | "primary";
  size?: "default" | "sm" | "lg" | "icon";
}

/*
 * Button design system — Linear + Raycast principles:
 *
 *  default  → White-filled, semi-transparent surface with Raycast inset highlight.
 *             Used for the single dominant CTA per screen.
 *  primary  → Brand-violet filled (quartz-500 tint), for connector "Connect" actions.
 *  glass    → Glass panel surface with inset top-highlight; for secondary actions.
 *  ghost    → No background until hover; whisper-thin border on hover.
 *             Linear's "nearly transparent" button pattern.
 *  danger   → Red tint for destructive actions.
 *
 *  Interactions use CSS transitions (opacity + transform) — no framer-motion —
 *  keeping the component dependency-free and render-lightweight.
 */

const BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium " +
  "transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-white/20 focus-visible:ring-offset-1 focus-visible:ring-offset-[#07090b] " +
  "disabled:pointer-events-none disabled:opacity-40 active:scale-[0.97]";

const VARIANTS: Record<string, string> = {
  // Raycast: semi-transparent white pill, dark text, inset top highlight
  default:
    "bg-[hsla(0,0%,100%,0.92)] text-[#0d0f11] hover:bg-white " +
    "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),inset_0_-1px_0_0_rgba(0,0,0,0.15),0_1px_3px_rgba(0,0,0,0.4)] " +
    "hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,1),0_2px_8px_rgba(0,0,0,0.5)]",

  // Brand-violet — for primary connector CTAs
  primary:
    "bg-[#5e6ad2] text-white hover:bg-[#6b78e0] " +
    "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),inset_0_-1px_0_0_rgba(0,0,0,0.25),0_1px_3px_rgba(0,0,0,0.4)] " +
    "hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25),0_2px_8px_rgba(94,106,210,0.35)]",

  // Glass — elevated surface, inset highlight + backdrop blur
  glass:
    "bg-[rgba(255,255,255,0.05)] text-white/80 hover:text-white " +
    "border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.14)] " +
    "backdrop-blur-sm " +
    "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),inset_0_-1px_0_0_rgba(0,0,0,0.2)] " +
    "hover:bg-[rgba(255,255,255,0.08)]",

  // Ghost — Linear pattern: near-invisible until interaction
  ghost:
    "bg-transparent text-white/50 hover:text-white/90 " +
    "hover:bg-[rgba(255,255,255,0.04)] hover:border hover:border-[rgba(255,255,255,0.08)] " +
    "border border-transparent",

  // Danger — red tint
  danger:
    "bg-red-500/10 text-red-400 hover:bg-red-500/20 " +
    "border border-red-500/20 hover:border-red-500/35",
};

const SIZES: Record<string, string> = {
  default: "h-9 px-4 py-2",
  sm:      "h-7 rounded-md px-3 text-xs",
  lg:      "h-10 px-6 text-sm",
  icon:    "h-9 w-9 rounded-lg p-0",
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button };
