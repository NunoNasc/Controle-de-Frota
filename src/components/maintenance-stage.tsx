import {maintenanceStages,type MaintenanceStageKey} from '@/lib/maintenance';
const tone:Record<MaintenanceStageKey,string>={REQUESTED:'badge-yellow',ANALYSIS:'badge-blue',AWAITING_QUOTE:'badge-yellow',AWAITING_APPROVAL:'badge-yellow',AWAITING_PART:'badge-orange',SCHEDULED:'badge-blue',IN_SERVICE:'badge-blue',TESTING:'badge-orange',DONE:'badge-green',CANCELED:'badge-gray'};
export function MaintenanceStageBadge({stage}:{stage:MaintenanceStageKey}){return <span className={`badge ${tone[stage]}`}>{maintenanceStages[stage]}</span>;}
