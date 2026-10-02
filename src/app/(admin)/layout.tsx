import { AppShell } from '@/components/app-shell';
export const dynamic = 'force-dynamic';
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  if (process.env.ALLOW_DEV_ADMIN !== 'true' || process.env.NODE_ENV === 'production') return <main className="access-notice"><h1>Acesso administrativo protegido</h1><p>O acesso local de desenvolvimento está desabilitado. Configure a autenticação antes de disponibilizar o ambiente em produção.</p></main>;
  return <AppShell>{children}</AppShell>;
}
