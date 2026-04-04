"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: "default" | "glass" | "ghost" | "danger";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    
    // Using framer-motion for the tactile feel unless asChild is used
    if (asChild) {
      return (
        <Comp
          className={cn(
            "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-quartz-500 disabled:pointer-events-none disabled:opacity-50",
            {
              "bg-quartz-500 text-black hover:bg-quartz-500/90 shadow-sm": variant === "default",
              "glass glass-hover text-foreground": variant === "glass",
              "hover:bg-white/5 text-foreground": variant === "ghost",
              "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30": variant === "danger",
              "h-9 px-4 py-2": size === "default",
              "h-8 rounded-md px-3 text-xs": size === "sm",
              "h-10 rounded-md px-8": size === "lg",
              "h-9 w-9": size === "icon",
            },
            className
          )}
          ref={ref}
          {...props}
        />
      );
    }

    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-quartz-500 disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-foreground text-background hover:bg-foreground/90 shadow-[0_0_15px_rgba(255,255,255,0.1)]": variant === "default",
            "glass glass-hover text-foreground": variant === "glass",
            "hover:bg-white/5 text-foreground": variant === "ghost",
            "bg-red-500/20 text-red-500 hover:bg-red-500/30 border border-red-500/30": variant === "danger",
            "h-10 px-5 py-2": size === "default",
            "h-8 rounded-md px-3 text-xs": size === "sm",
            "h-11 rounded-md px-8": size === "lg",
            "h-10 w-10": size === "icon",
          },
          className
        )}
        ref={ref}
        {...(props as any)}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
