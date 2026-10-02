import {purchaseStages,type PurchaseStageKey} from '@/lib/purchases';
const tone:Record<PurchaseStageKey,string>={PENDING:'yellow',APPROVAL:'blue',APPROVED:'green',REJECTED:'red',CONTINGENCY:'orange',ORDERED:'blue',WAITING_SUPPLIER:'yellow',DELIVERED:'green',FINISHED:'green',CANCELED:'gray'};
export function PurchaseStageBadge({stage}:{stage:PurchaseStageKey}){return <span className={`badge badge-${tone[stage]}`}>{purchaseStages[stage]}</span>;}
