import {alertPriorities,alertStages} from '@/lib/alerts';
export function AlertPriority({value}:{value:keyof typeof alertPriorities}){return <span className={`badge ${{CRITICAL:'badge-red',HIGH:'badge-orange',MEDIUM:'badge-yellow',LOW:'badge-green'}[value]}`}>{alertPriorities[value]}</span>;}
export function AlertStatus({value}:{value:keyof typeof alertStages}){return <span className={`badge ${{NEW:'badge-yellow',IN_PROGRESS:'badge-blue',RESOLVED:'badge-green',HANDLED:'badge-green',NOT_APPLICABLE:'badge-gray',RULE_CLOSED:'badge-gray'}[value]}`}>{alertStages[value]}</span>;}
