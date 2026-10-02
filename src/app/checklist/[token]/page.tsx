import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { DriverChecklist } from '@/components/driver-checklist';
import { checklistVehicleWhere,isChecklistToken } from '@/lib/vehicle-checklist-link';
import { getVehicleInspection } from '@/lib/checklist-config';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Checklist do veículo', robots: { index: false, follow: false } };
export default async function ChecklistPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params; const where = checklistVehicleWhere(token); if (!where) notFound();
  const v = await prisma.vehicle.findUnique({ where, select: { plate: true, model: true, code:true, mileage: true, status: true, operationalStatus:true, active: true,profile:true,category:true } });
  if (!v || !v.active || v.status === 'INACTIVE') notFound();
  if(!isChecklistToken(token))return <main className="mx-auto max-w-lg p-6"><p className="text-sm text-slate-500">CHECKLIST DO MOTORISTA</p><h1 className="mt-3 text-3xl font-bold">{v.plate}</h1><p className="mt-2">{v.model}{v.code?` · ${v.code}`:''}</p><div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-semibold">Leia o QR Code atualizado do veículo</h2><p className="mt-2 text-sm">Para preencher e enviar o checklist, use a etiqueta com acesso seguro fornecida pela Frota. O endereço com a placa apenas identifica o veículo.</p></div></main>;
  const config=await getVehicleInspection(prisma,v);
  if(!config.items.length)return <main className="max-w-lg mx-auto p-6"><h1 className="text-2xl font-semibold">Checklist não configurado</h1><p className="mt-4">Não há itens ativos para {v.plate}. Entre em contato com a Frota.</p></main>;
  return <DriverChecklist token={token} vehicle={v} inspectionItems={config.items} configVersion={config.version}/>;
}
