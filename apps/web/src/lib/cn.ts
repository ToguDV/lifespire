import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge conditional class names and de-duplicate conflicting Tailwind utilities.
 * Convention borrowed from shadcn/ui so the local `components/ui` primitives can
 * be swapped for generated ones without touching call sites.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
