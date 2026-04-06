"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
}

/*
 * Input — Linear/Raycast design principles:
 * - Background: near-black with minimal opacity tint (surface-1)
 * - Border: rgba(255,255,255,0.08) at rest — whisper-thin, semi-transparent white
 * - Focus: brightened border + subtle blue glow ring (Raycast info-blue tint)
 * - Placeholder: white/25 — readable but clearly secondary
 * - Font features inherited from body (cv01, ss03)
 */

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, helpText, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);
    const isPassword = type === "password";

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label className="text-[11px] font-medium text-white/40 uppercase tracking-widest">
            {label}
            {props.required && <span className="text-[#ff6b6b] ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          <input
            type={isPassword && !showPassword ? "password" : type === "password" ? "text" : type}
            className={cn(
              // Base
              "flex h-9 w-full rounded-lg px-3 py-2 text-sm text-white/90",
              // Surface — Linear level-2 surface
              "bg-[rgba(255,255,255,0.03)]",
              // Border — whisper-thin at rest
              "border border-[rgba(255,255,255,0.08)]",
              // Placeholder
              "placeholder:text-white/25",
              // Transitions
              "transition-all duration-150",
              // Focus — brightened border + Raycast blue glow
              "focus-visible:outline-none",
              "focus-visible:border-[rgba(255,255,255,0.2)]",
              "focus-visible:bg-[rgba(255,255,255,0.05)]",
              "focus-visible:shadow-[0_0_0_3px_rgba(24,191,255,0.08),inset_0_1px_0_0_rgba(255,255,255,0.06)]",
              // Error state
              error && "border-red-500/40 focus-visible:border-red-500/60 focus-visible:shadow-[0_0_0_3px_rgba(239,68,68,0.08)]",
              // Disabled
              "disabled:cursor-not-allowed disabled:opacity-40",
              // Password padding
              isPassword && "pr-10",
              className
            )}
            ref={ref}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          )}
        </div>
        {error && <p className="text-[11px] text-red-400/80 mt-1">{error}</p>}
        {helpText && !error && <p className="text-[11px] text-white/25 mt-1 leading-relaxed">{helpText}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
