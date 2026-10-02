'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Bell, ClipboardCheck, TriangleAlert, Truck, Wrench, CalendarClock, CircleDot, ShoppingCart, Building2, Users, ChartNoAxesCombined, Settings2, PanelLeftClose, PanelLeftOpen, Menu, X, ChevronRight, ShieldCheck } from 'lucide-react';
import { navigation } from '@/lib/navigation';
import { Button } from '@/components/ui/button';
const icons = { dashboard: LayoutDashboard, bell: Bell, check: ClipboardCheck, alert: TriangleAlert, truck: Truck, wrench: Wrench, calendar: CalendarClock, circle: CircleDot, cart: ShoppingCart, building: Building2, users: Users, chart: ChartNoAxesCombined, settings: Settings2 };
export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false); const [mobileOpen, setMobileOpen] = useState(false); const path = usePathname();
  const current = path.startsWith('/painel/') ? 'Dashboard' : navigation.find(n => path === `/${n.slug}` || (n.slug !== '' && path.startsWith(`/${n.slug}/`)))?.label ?? 'Frota';
  return <div className={`app-shell ${collapsed ? 'is-collapsed' : ''}`}>
    <a className="skip-link" href="#main">Pular para conteúdo</a>
    {mobileOpen && <button className="sidebar-backdrop" aria-label="Fechar menu" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? 'is-open' : ''}`} aria-label="Menu principal">
      <Link href="/" className="brand" aria-label="Central de Controle de Frota — início"><span className="brand-icon"><Truck size={24}/></span><span className="sidebar-text"><strong>CENTRAL DE FROTA</strong><small>Controle que move a operação</small></span></Link>
      <Button className="mobile-close" variant="ghost" size="icon" aria-label="Fechar menu" onClick={() => setMobileOpen(false)}><X/></Button>
      <nav>{navigation.map(n => { const Icon = icons[n.icon]; const active = path === `/${n.slug}` || (n.slug === '' && path.startsWith('/painel/')) || (n.slug !== '' && n.slug !== 'painel' && path.startsWith(`/${n.slug}/`)); return <div key={n.slug}>{'group' in n && <p className="nav-group sidebar-text">{n.group}</p>}<Link title={n.label} href={`/${n.slug}`} aria-current={active ? 'page' : undefined} className={`nav-link ${active ? 'active' : ''}`} onClick={() => setMobileOpen(false)}><Icon size={19}/><span className="sidebar-text">{n.label}</span>{active && <span className="active-mark sidebar-text"/>}</Link></div>; })}</nav>
      <div className="sidebar-bottom"><span className="sidebar-text"><ShieldCheck size={17}/> Ambiente de desenvolvimento</span><Button variant="ghost" className="collapse-button" onClick={() => setCollapsed(v => !v)} aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}>{collapsed ? <PanelLeftOpen/> : <><PanelLeftClose/><span>Recolher menu</span></>}</Button></div>
    </aside>
    <div className="workspace"><header className="topbar"><div className="flex items-center gap-3"><Button className="mobile-menu" size="icon" variant="ghost" aria-label="Abrir menu" onClick={() => setMobileOpen(true)}><Menu/></Button><span className="breadcrumb-root">Workspace</span><ChevronRight size={14} className="text-slate-300"/><span className="text-sm font-medium text-slate-700">{current}</span></div><div className="flex items-center gap-5"><span className="demo-label">CONTROLE DE FROTA</span><Link href="/alertas" className="notification" aria-label="Abrir Central de Alertas"><Bell size={20}/></Link><div className="profile"><span className="avatar">FR</span><div><strong>Equipe de Frota</strong><small>Acesso local de desenvolvimento</small></div></div></div></header><main id="main">{children}</main><footer className="app-footer"><span>Central de Controle de Frota</span><span>Ambiente local · versão inicial</span></footer></div>
  </div>;
}
