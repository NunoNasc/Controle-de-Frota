import {restrictionLabels,safetyNotice} from '@/lib/restrictions';
export function RestrictionBanner({status,driver=false}:{status:string;driver?:boolean}){
 if(status==='CLEAR')return null;
 return <div role="note" className="my-4 rounded-xl border-2 border-red-300 bg-red-50 p-4 text-red-950"><p className="text-sm font-bold">VEÍCULO COM RESTRIÇÃO OPERACIONAL</p><p className="mt-1 font-semibold">{restrictionLabels[status as keyof typeof restrictionLabels]??'Avaliação necessária'}</p><p className="mt-2 text-sm">{driver?'O envio do checklist não libera o veículo. Aguarde a avaliação e siga as orientações da Frota.':'A disponibilidade permanece restrita até a avaliação e o registro das liberações necessárias.'}</p><p className="mt-2 text-xs leading-relaxed">{safetyNotice}</p></div>;
}
