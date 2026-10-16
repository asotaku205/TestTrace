import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils.js';

type Variant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
type Size = 'sm' | 'default' | 'lg' | 'icon';

const variants: Record<Variant, string> = {
  default: 'bg-neutral-950 text-white hover:bg-neutral-800 shadow-sm',
  secondary: 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200',
  outline: 'border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-900',
  ghost: 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950',
  destructive: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] rounded-md',
  default: 'h-10 px-4 rounded-lg',
  lg: 'h-11 px-6 rounded-lg text-[15px]',
  icon: 'h-9 w-9 rounded-md',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold text-sm',
        'transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
        'active:scale-[0.98]',
        variants[variant],
        sizes[size],
        variant === 'default' && 'hover:shadow-[0_0_24px_rgba(0,0,0,0.28)]',
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
