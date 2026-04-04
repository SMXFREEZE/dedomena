import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Generate unique IDs
export const genId = () => Math.random().toString(36).slice(2, 11);

// Utility for formatting characters
export const fmtChars = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k chars` : `${n} chars`;
