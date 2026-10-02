import Link from 'next/link';
import {MaintenanceForm} from '@/components/maintenance-form';
import {getMaintenanceOptions} from '@/lib/maintenance-options';
import {prisma} from '@/lib/prisma';
export default async function NewMaintenance({searchParams}:{searchParams:Promise<{incident?:string;vehicle?:string}>}){
 const query=await searchParams;const incident=query.incident?await prisma.incident.findUnique({where:{id:query.incident}}):null;
 return <div className="page max-w-5xl"><Link className="subtle-link" href="/manutencoes">← Manutenções</Link><div className="page-heading mt-5"><div><div className="eyebrow">ORDEM DE SERVIÇO</div><h1>Solicitar manutenção</h1><p>Registre o serviço, seus vínculos e a indisponibilidade quando houver.</p></div></div><MaintenanceForm options={await getMaintenanceOptions()} initialVehicleId={incident?.vehicleId??query.vehicle??''} initialIncidentId={incident?.id??''}/></div>;
}
