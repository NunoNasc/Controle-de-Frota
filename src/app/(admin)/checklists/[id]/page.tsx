import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { checklistItems } from '@/lib/checklist';
import { StatusBadge, labels } from '@/components/status-badge';
import { date,integer } from '@/lib/utils';
export default async function ChecklistDetails({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const record=await prisma.checklist.findUnique({where:{id},include:{vehicle:true,answers:{include:{photos:true,evaluation:{include:{alert:true}}}}}});
  if(!record)notFound();
  return <div className="page"><Link href="/checklists" className="subtle-link">← Voltar aos checklists</Link><div className="page-heading mt-5"><div><h1>Checklist · {record.vehicle.plate}</h1><p>{record.driverName} · Identificação: {record.driverIdentification ?? 'Não informada'} · {integer(record.mileage)} km · {date(record.submittedAt)}</p></div><StatusBadge status={record.result}/></div><div className="grid gap-4 md:grid-cols-2">{record.answers.map(answer=>{
    const definition=checklistItems.find(i=>i.id===answer.item);
    return <section key={answer.id} className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{answer.itemLabel ?? definition?.label ?? answer.item}</h2><StatusBadge status={answer.answer}/></div><p className="text-xs text-slate-500 mt-2">{answer.categoryLabel} · Criticidade: {labels[answer.priority]} · Foto {answer.requiresPhoto ? 'obrigatória' : 'opcional'}{answer.incidentRule ? ' · Gera ocorrência' : ' · Sem ocorrência automática'}{answer.blocksVehicle ? ' · Regra de bloqueio' : ''}</p>{answer.problemType && <p className="mt-3 font-medium">{answer.problemType}</p>}{answer.notes && <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{answer.notes}</p>}{answer.evaluation?.alert && <Link className="subtle-link mt-4" href={`/alertas/${answer.evaluation.alert.id}`}>Ver avaliação, alerta e ocorrência</Link>}{answer.photos.map(photo=>photo.content ? <Image key={photo.id} src={`data:image/jpeg;base64,${Buffer.from(photo.content).toString('base64')}`} unoptimized width={420} height={300} alt={photo.description ?? 'Foto do problema'} className="mt-4 max-h-80 w-full rounded-lg object-contain bg-slate-50"/> : <p key={photo.id} className="text-sm mt-3">{photo.fileName} · Arquivo legado sem conteúdo local</p>)}</section>;
  })}</div></div>;
}
