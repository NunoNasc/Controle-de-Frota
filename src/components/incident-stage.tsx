import {incidentStages} from '@/lib/incidents';
const tones:Record<string,string>={NEW:'badge-yellow',ANALYSIS:'badge-blue',AWAITING_APPROVAL:'badge-yellow',AWAITING_PART:'badge-orange',AWAITING_SUPPLIER:'badge-orange',SCHEDULED:'badge-blue',UNDER_MAINTENANCE:'badge-blue',AWAITING_TEST:'badge-yellow',RELEASED:'badge-green',DONE:'badge-green',REJECTED:'badge-gray',VOID:'badge-gray',CONTINGENCY:'badge-red'};
export function IncidentStageBadge({stage}:{stage:keyof typeof incidentStages}){return <span className={`badge ${tones[stage]}`}>{incidentStages[stage]}</span>;}
