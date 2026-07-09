"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "danger" | "ghost" | "warn";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent-500 text-space-950 hover:bg-accent-400 disabled:bg-space-600 disabled:text-space-400",
  danger:
    "bg-danger-500 text-white hover:bg-danger-600 disabled:bg-space-600 disabled:text-space-400",
  warn: "bg-warn-400 text-space-950 hover:brightness-110 disabled:bg-space-600 disabled:text-space-400",
  ghost:
    "bg-space-800/80 text-space-200 border border-space-600 hover:border-accent-400 hover:text-white disabled:opacity-50",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm rounded-lg",
  md: "px-5 py-2.5 text-base rounded-xl",
  lg: "px-7 py-3.5 text-lg rounded-2xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className = "", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`font-bold tracking-wide transition-all active:scale-95 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  );
});
