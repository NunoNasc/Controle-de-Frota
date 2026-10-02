import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: { default: 'Central de Controle de Frota', template: '%s | Central de Frota' }, description: 'Gestão operacional da frota, checklists e manutenção.', icons: { icon: '/favicon.svg' } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="pt-BR"><body>{children}</body></html>; }
