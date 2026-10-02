import { cn } from '@/lib/utils';
export function Table({ className, ...props }: React.ComponentProps<'table'>) { return <div className="w-full overflow-x-auto"><table className={cn('w-full text-left text-sm', className)} {...props} /></div>; }
export function TableHeader(props: React.ComponentProps<'thead'>) { return <thead className="border-y border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500" {...props} />; }
export function TableBody(props: React.ComponentProps<'tbody'>) { return <tbody className="divide-y divide-slate-100" {...props} />; }
export function TableRow(props: React.ComponentProps<'tr'>) { return <tr className="transition-colors hover:bg-slate-50/70" {...props} />; }
export function TableHead(props: React.ComponentProps<'th'>) { return <th className="whitespace-nowrap px-5 py-3 font-semibold" {...props} />; }
export function TableCell({ className, ...props }: React.ComponentProps<'td'>) { return <td className={cn('px-5 py-4', className)} {...props} />; }
