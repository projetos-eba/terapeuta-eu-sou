import Link from "next/link";
import type { Route } from "next";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

import { cn } from "@/lib/utils";

type TESButtonVariant = "primary" | "gradient" | "secondary" | "ghost";
type TESButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<TESButtonVariant, string> = {
  primary:
    "bg-brand-primary text-white shadow-card hover:bg-brand-primaryHover",
  gradient:
    "bg-[linear-gradient(135deg,var(--tes-color-brand-primary)_0%,var(--tes-color-brand-primary-hover)_100%)] text-white shadow-soft hover:shadow-float",
  secondary:
    "border border-border bg-white text-brand-primary shadow-card hover:border-brand-lavender",
  ghost: "text-brand-primary hover:bg-brand-lavenderSoft",
};

const sizeClasses: Record<TESButtonSize, string> = {
  sm: "min-h-11 px-4 py-2 text-sm",
  md: "min-h-11 px-5 py-3 text-sm",
  lg: "min-h-12 px-7 py-3 text-base",
};

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-full font-extrabold transition focus:outline-none focus:ring-4 focus:ring-ring/20 disabled:pointer-events-none disabled:opacity-60";

type CommonProps = {
  children: ReactNode;
  className?: string;
  size?: TESButtonSize;
  variant?: TESButtonVariant;
};

type ButtonProps = CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: never;
  };

type LinkProps = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    href: string;
  };

export type TESButtonProps = ButtonProps | LinkProps;

export function TESButton(props: TESButtonProps) {
  const { children, className, size = "md", variant = "primary" } = props;
  const classes = cn(
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    className,
  );

  if ("href" in props && props.href) {
    const linkButtonProps = props as LinkProps;
    const {
      children: linkChildren,
      className: _className,
      size: _size,
      variant: _variant,
      href,
      ...linkProps
    } = linkButtonProps;

    return (
      <Link {...linkProps} href={href as Route<string>} className={classes}>
        {linkChildren}
      </Link>
    );
  }

  const baseButtonProps = props as ButtonProps;
  const {
    children: buttonChildren,
    className: _className,
    size: _size,
    variant: _variant,
    ...buttonProps
  } = baseButtonProps;

  return (
    <button {...buttonProps} className={classes}>
      {buttonChildren}
    </button>
  );
}
