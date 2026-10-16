import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils.js';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-10 w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-sm',
        'placeholder:text-neutral-400',
        'focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 transition',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
