import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export const integer = (n: number | null) => n === null ? 'Não informado' : new Intl.NumberFormat('pt-BR').format(n);
export const currency = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
export const date = (d: Date | string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Bahia' }).format(new Date(d));
