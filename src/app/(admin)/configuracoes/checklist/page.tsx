import Link from 'next/link';
import {prisma} from '@/lib/prisma';
import {vehicleChecklistType} from '@/lib/checklist-config';
import {ChecklistConfigurator} from '@/components/checklist-configurator';
export const dynamic='force-dynamic';
export const metadata={title:'Configuração do checklist'};
export default async function ChecklistConfiguration(){
 const [categories,items,vehicles]=await Promise.all([prisma.checklistCategory.findMany({orderBy:{sortOrder:'asc'}}),prisma.checklistItemConfig.findMany({orderBy:[{category:{sortOrder:'asc'}},{sortOrder:'asc'},{label:'asc'}]}),prisma.vehicle.findMany({select:{profile:true,category:true}})]);
 const types=Array.from(new Set([...vehicles.map(vehicleChecklistType),...items.flatMap(i=>i.vehicleTypes)])).sort();
 return <div className="page"><Link href="/configuracoes" className="subtle-link">← Configurações</Link><div className="page-heading mt-5"><div><div className="eyebrow">CHECKLIST DO MOTORISTA</div><h1>Itens e regras do checklist</h1><p>Configure o que cada tipo de veículo precisa inspecionar.</p></div></div><ChecklistConfigurator categories={categories.map(c=>({id:c.id,name:c.name}))} types={types} items={items.map(i=>({...i,createdAt:i.createdAt.toISOString(),updatedAt:i.updatedAt.toISOString()}))}/></div>;
}
