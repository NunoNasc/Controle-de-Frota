import Link from 'next/link';
import {prisma} from '@/lib/prisma';
import {getPurchaseOptions} from '@/lib/purchase-options';
import {PurchaseForm} from '@/components/purchase-form';
export default async function NewPurchase({searchParams}:{searchParams:Promise<{incident?:string;maintenance?:string;vehicle?:string}>}){
 const p=await searchParams;const incident=p.incident?await prisma.incident.findUnique({where:{id:p.incident}}):null;const maintenance=p.maintenance?await prisma.maintenance.findUnique({where:{id:p.maintenance}}):null;
 return <div className="page max-w-5xl"><Link href="/compras" className="subtle-link">← Pedidos de Compras</Link><header className="page-heading mt-5"><div><h1>Nova solicitação</h1><p>Registre a necessidade antes ou depois da geração do pedido.</p></div></header><PurchaseForm requestedAt={new Date().toISOString()} options={await getPurchaseOptions()} initialVehicle={maintenance?.vehicleId??incident?.vehicleId??p.vehicle??''} initialIncident={incident?.purchaseOrderId?'':incident?.id} initialMaintenance={maintenance?.purchaseOrderId?'':maintenance?.id}/></div>;
}
