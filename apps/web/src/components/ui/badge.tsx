import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils.js';

type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'outline';

const styles: Record<BadgeVariant, string> = {
  default: 'bg-neutral-950 text-white',
  secondary: 'bg-neutral-100 text-neutral-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-rose-100 text-rose-700',
  info: 'bg-sky-100 text-sky-700',
  outline: 'border border-neutral-300 text-neutral-700',
};

export function Badge({
  variant = 'default',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap',
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}

export function FieldLabel({
  className,
  ...props
}: HTMLAttributes<HTMLLabelElement> & { htmlFor?: string }) {
  const { htmlFor, ...rest } = props as HTMLAttributes<HTMLLabelElement> & { htmlFor?: string };
  return (
    <label htmlFor={htmlFor} className={cn('block text-sm font-semibold mb-1.5', className)} {...rest} />
  );
}
