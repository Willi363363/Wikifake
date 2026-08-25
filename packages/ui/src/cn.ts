// Joining class names, with the last word winning.
//
// `clsx` flattens conditionals; `tailwind-merge` resolves the conflicts they
// produce. Without the second, `cn('px-4', 'px-6')` emits both and which one
// applies depends on the order Tailwind happened to generate them in — so a
// caller overriding a component's padding would sometimes work and sometimes
// not, which is worse than never working.
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
