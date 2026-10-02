import { cn } from '@/lib/utils';
export function Card({ className, ...props }: React.ComponentProps<'section'>) { return <section className={cn('min-w-0 rounded-xl border border-slate-200 bg-white shadow-xs', className)} {...props} />; }
