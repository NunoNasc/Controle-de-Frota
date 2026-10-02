import {preventiveLabels,type PreventiveState} from '@/lib/preventive';
const tones={CURRENT:'badge-green',UPCOMING:'badge-blue',ATTENTION:'badge-yellow',OVERDUE:'badge-red',UNKNOWN:'badge-gray'};
export function PreventiveBadge({status}:{status:PreventiveState}){return <span className={`badge ${tones[status]}`}>{preventiveLabels[status]}</span>;}
