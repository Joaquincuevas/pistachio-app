import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function Card({ interactive, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-card border border-border bg-white shadow-subtle',
        interactive &&
          'cursor-pointer transition-all duration-150 hover:border-accent/40 hover:shadow-raised active:scale-[0.99]',
        className,
      )}
      {...props}
    />
  );
}
