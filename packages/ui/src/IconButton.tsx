import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { Button, type ButtonSize, type ButtonVariant } from "./Button";
import { mergeClassNames } from "./classes";

export type IconButtonProps = Omit<ComponentPropsWithoutRef<"button">, "aria-label" | "children"> & {
  children: ReactNode;
  label: string;
  pressed?: boolean;
  size?: Extract<ButtonSize, `icon-${string}`>;
  variant?: ButtonVariant;
};

export function IconButton({
  children,
  className,
  label,
  pressed,
  size = "icon-sm",
  variant = "ghost",
  ...props
}: IconButtonProps) {
  return (
    <Button
      className={mergeClassNames("rounded-lg", className)}
      size={size}
      variant={variant}
      aria-label={label}
      {...(pressed === undefined ? {} : { "aria-pressed": pressed })}
      {...props}
    >
      {children}
    </Button>
  );
}
