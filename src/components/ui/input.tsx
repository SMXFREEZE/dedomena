"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, helpText, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);
    const isPassword = type === "password";

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-white/50">
            {label}
            {props.required && <span className="text-coral-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          <input
            type={isPassword && !showPassword ? "password" : type === "password" ? "text" : type}
            className={cn(
              "flex h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-quartz-500 focus-visible:border-quartz-500 disabled:cursor-not-allowed disabled:opacity-50",
              error && "border-red-500/50 focus-visible:ring-red-500/50",
              className
            )}
            ref={ref}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-500/90 mt-1">{error}</p>}
        {helpText && !error && <p className="text-[11px] text-white/30 mt-1">{helpText}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
