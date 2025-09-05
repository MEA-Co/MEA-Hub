import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function apiUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_BACKEND_ORIGIN;
  return base ? `${base}${path}` : path;
}

export function wsUrl(path: string) {
  const explicit = process.env.NEXT_PUBLIC_BACKEND_ORIGIN;
  const origin =
    explicit ?? (typeof window !== 'undefined' ? window.location.origin : '');
  if (!origin) return path;

  const wsOrigin = origin.startsWith('https')
    ? origin.replace('https', 'wss')
    : origin.replace('http', 'ws');

  return `${wsOrigin}${path}`;
}
