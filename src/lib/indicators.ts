import {Prisma} from '@prisma/client';
import {prisma} from './prisma';
import type {IndicatorFilters} from './indicator-filters';
export type IndicatorReport={
 fleet:{total:number;available:number;stopped:number;unknown:number;availability:number|null;overdue:number;noPlan:number};
 incidents:{total:number;critical:number;repeated:number;solutionHours:number|null;solved:number};
 checks:{total:number;applicable:number;ok:number;conformity:number|null};
 downtime:{hours:number|null;episodes:number;vehicles:number};
 preventive:{onTime:number;late:number;unknown:number;rate:number|null};
 costs:{total:number|null;known:number;unknown:number};
 vehicles:{id:string;plate:string;model:string;incidents:number;critical:number;problems:number;cost:number|null;unknownCosts:number}[];
 categories:{category:string;total:number;critical:number}[];
 recurrence:{vehicleId:string;plate:string;problem:string;category:string;total:number;repeats:number}[];
 costKinds:{kind:string;cost:number|null;known:number;unknown:number}[];
};
// All counts, ratios, interval unions and monetary sums execute in PostgreSQL.
// Parameters are bound by Prisma; no user text is interpolated into SQL identifiers.
export async function getIndicators(f:IndicatorFilters){
 if(!f.valid)throw new Error('Período inválido');
 const scope=Prisma.sql`WITH v AS (
 SELECT * FROM "Vehicle" WHERE (${f.vehicle}='' OR id=${f.vehicle})
 AND (${f.type}='' OR COALESCE(NULLIF(profile,''),category)=${f.type})
 AND (${f.costCenter}='' OR (${f.costCenter}='unassigned' AND "costCenterId" IS NULL) OR "costCenterId"=${f.costCenter})
 ), fleet AS (SELECT * FROM v WHERE active AND status<>'INACTIVE'),
 i AS (SELECT i.* FROM "Incident" i JOIN v ON v.id=i."vehicleId" WHERE i."openedAt">=${f.start} AND i."openedAt"<${f.end} AND i.stage NOT IN ('REJECTED','VOID') AND i.status<>'CANCELED'),
 solved AS (SELECT i.* FROM "Incident" i JOIN v ON v.id=i."vehicleId" WHERE i."resolvedAt">=${f.start} AND i."resolvedAt"<${f.end} AND i."resolvedAt">=i."openedAt" AND i.stage IN ('RELEASED','DONE')),
 checks AS (SELECT c.* FROM "Checklist" c JOIN v ON v.id=c."vehicleId" WHERE c."submittedAt">=${f.start} AND c."submittedAt"<${f.end} AND c.status IN ('SUBMITTED','REVIEWED')),
 answers AS (SELECT a.* FROM "ChecklistAnswer" a JOIN checks c ON c.id=a."checklistId"),
 costs AS (SELECT m.* FROM "Maintenance" m JOIN v ON v.id=m."vehicleId" WHERE m.stage='DONE' AND m."completedAt">=${f.start} AND m."completedAt"<${f.end}),
 problems AS (SELECT i.id,i."vehicleId" FROM i UNION ALL SELECT a.id,c."vehicleId" FROM answers a JOIN checks c ON c.id=a."checklistId" WHERE a.answer='ISSUE' AND NOT EXISTS (SELECT 1 FROM "Incident" linked WHERE linked.id=a."incidentId")),
 recurrence AS (SELECT i.*,lower(regexp_replace(trim(i.title),'[[:space:]]+',' ','g')) AS problem_key FROM i),
 repeats AS (SELECT "vehicleId",category,problem_key,min(title) AS problem,count(*) AS total FROM recurrence GROUP BY "vehicleId",category,problem_key HAVING count(*)>1),
 raw_stops AS (
 SELECT m."vehicleId",m."unavailableFrom" AS start_at,COALESCE(m."unavailableUntil",m."completedAt",${f.now}) AS end_at FROM "Maintenance" m JOIN v ON v.id=m."vehicleId" WHERE m."unavailableFrom" IS NOT NULL
 UNION ALL SELECT r."vehicleId",r."detectedAt",COALESCE(r."releasedAt",${f.now}) FROM "VehicleRestriction" r JOIN v ON v.id=r."vehicleId"
 ), clipped AS (SELECT "vehicleId",greatest(start_at,${f.start}) AS s,least(end_at,${f.end}) AS e FROM raw_stops WHERE start_at<${f.end} AND end_at>${f.start}),
 ordered AS (SELECT *,max(e) OVER(PARTITION BY "vehicleId" ORDER BY s,e ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS previous_end FROM clipped WHERE e>s),
 islands AS (SELECT *,sum(CASE WHEN previous_end IS NULL OR s>previous_end THEN 1 ELSE 0 END) OVER(PARTITION BY "vehicleId" ORDER BY s,e) AS island FROM ordered),
 stops AS (SELECT "vehicleId",extract(epoch FROM max(e)-min(s))/3600 AS hours FROM islands GROUP BY "vehicleId",island),
 cycles AS (
 SELECT DISTINCT ON(p."vehicleId",e.after->>'lastAt',e.after->>'lastMileage') p."vehicleId",e.before,e.after
 FROM "PreventivePlanEvent" e JOIN "PreventivePlan" p ON p.id=e."planId" JOIN v ON v.id=p."vehicleId"
 WHERE e.before IS NOT NULL AND e.before<>'null'::jsonb
 AND (e.after->>'lastAt')::timestamptz>=${f.start} AND (e.after->>'lastAt')::timestamptz<${f.end}
 AND ((e.after->>'lastAt')::timestamptz>COALESCE((e.before->>'lastAt')::timestamptz,'-infinity'::timestamptz)
 OR (e.after->>'lastMileage')::int>COALESCE((e.before->>'lastMileage')::int,-1))
 ORDER BY p."vehicleId",e.after->>'lastAt',e.after->>'lastMileage',e."createdAt",e.id
 ), cycle_results AS (SELECT CASE
 WHEN ((after->>'lastMileage')::int>(before->>'nextMileage')::int)
 OR (((after->>'lastAt')::timestamptz AT TIME ZONE 'America/Bahia')::date>((before->>'dueAt')::timestamptz AT TIME ZONE 'America/Bahia')::date) THEN 'LATE'
 WHEN (before->>'nextMileage' IS NULL AND before->>'dueAt' IS NULL)
 OR (before->>'nextMileage' IS NOT NULL AND after->>'lastMileage' IS NULL) THEN 'UNKNOWN'
 ELSE 'ON_TIME' END AS result FROM cycles),
 all_cycle_results AS (SELECT result FROM cycle_results UNION ALL
 SELECT CASE WHEN (p."completedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bahia')::date>(p."dueAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bahia')::date THEN 'LATE' ELSE 'UNKNOWN' END
 FROM "Preventive" p JOIN v ON v.id=p."vehicleId" WHERE p."completedAt">=${f.start} AND p."completedAt"<${f.end}
 AND NOT EXISTS(SELECT 1 FROM cycles c WHERE c."vehicleId"=p."vehicleId" AND ((c.after->>'lastAt')::timestamptz AT TIME ZONE 'America/Bahia')::date=(p."completedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bahia')::date)),
 overdue AS (SELECT f.id FROM fleet f JOIN "PreventivePlan" p ON p."vehicleId"=f.id WHERE
 (p."nextMileage" IS NOT NULL AND f.mileage IS NOT NULL AND ((p."nextMileage"-f.mileage<0 AND f.mileage-p."nextMileage">=p."toleranceKm") OR (p."nextMileage"=f.mileage AND p."toleranceKm"=0)))
 OR (p."dueAt" IS NOT NULL AND ((${f.now}::timestamptz AT TIME ZONE 'America/Bahia')::date-(p."dueAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bahia')::date)>0 AND ((${f.now}::timestamptz AT TIME ZONE 'America/Bahia')::date-(p."dueAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bahia')::date)>=p."toleranceDays")
 UNION SELECT f.id FROM fleet f JOIN "Preventive" p ON p."vehicleId"=f.id WHERE p."completedAt" IS NULL AND ((p."dueAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bahia')::date<(${f.now}::timestamptz AT TIME ZONE 'America/Bahia')::date OR p."dueMileage"<=f.mileage)),
 vehicle_rows AS (SELECT v.id,v.plate,v.model,(SELECT count(*) FROM i WHERE i."vehicleId"=v.id) AS incidents,(SELECT count(*) FROM i WHERE i."vehicleId"=v.id AND priority='CRITICAL') AS critical,(SELECT count(*) FROM problems p WHERE p."vehicleId"=v.id) AS problems,(SELECT sum(cost) FROM costs c WHERE c."vehicleId"=v.id AND "costKnown") AS cost,(SELECT count(*) FROM costs c WHERE c."vehicleId"=v.id AND NOT "costKnown") AS "unknownCosts" FROM v)
 `;
 // Prisma stores timestamp-without-zone columns in UTC. Bind dates consistently even
 // when the PostgreSQL connection defaults to America/Bahia. Calendar rules remain explicit.
 const [row]=await prisma.$transaction(async tx=>{
 await tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;
 return tx.$queryRaw<{report:IndicatorReport}[]>(Prisma.sql`${scope} SELECT jsonb_build_object(
 'fleet',(SELECT jsonb_build_object('total',count(*),'available',count(*) FILTER(WHERE availability='AVAILABLE' AND status IN ('AVAILABLE','IN_USE') AND "operationalStatus"='CLEAR'),'stopped',count(*) FILTER(WHERE status IN ('STOPPED','MAINTENANCE') OR "operationalStatus"<>'CLEAR' OR availability='UNAVAILABLE'),'unknown',count(*) FILTER(WHERE (status='UNKNOWN' OR availability='UNKNOWN') AND status NOT IN ('STOPPED','MAINTENANCE') AND "operationalStatus"='CLEAR' AND availability<>'UNAVAILABLE'),'availability',CASE WHEN bool_or(status='UNKNOWN' OR availability='UNKNOWN') THEN NULL ELSE 100.0*count(*) FILTER(WHERE availability='AVAILABLE' AND status IN ('AVAILABLE','IN_USE') AND "operationalStatus"='CLEAR')/NULLIF(count(*),0) END,'overdue',(SELECT count(*) FROM overdue),'noPlan',count(*) FILTER(WHERE NOT EXISTS(SELECT 1 FROM "PreventivePlan" p WHERE p."vehicleId"=fleet.id))) FROM fleet),
 'incidents',(SELECT jsonb_build_object('total',count(*),'critical',count(*) FILTER(WHERE priority='CRITICAL'),'repeated',(SELECT COALESCE(sum(total-1),0) FROM repeats),'solutionHours',(SELECT avg(extract(epoch FROM "resolvedAt"-"openedAt")/3600) FROM solved),'solved',(SELECT count(*) FROM solved)) FROM i),
 'checks',(SELECT jsonb_build_object('total',(SELECT count(*) FROM checks),'applicable',count(*) FILTER(WHERE answer<>'NOT_APPLICABLE'),'ok',count(*) FILTER(WHERE answer='OK'),'conformity',100.0*count(*) FILTER(WHERE answer='OK')/NULLIF(count(*) FILTER(WHERE answer<>'NOT_APPLICABLE'),0)) FROM answers),
 'downtime',(SELECT jsonb_build_object('hours',avg(hours),'episodes',count(*),'vehicles',count(DISTINCT "vehicleId")) FROM stops),
 'preventive',(SELECT jsonb_build_object('onTime',count(*) FILTER(WHERE result='ON_TIME'),'late',count(*) FILTER(WHERE result='LATE'),'unknown',count(*) FILTER(WHERE result='UNKNOWN'),'rate',100.0*count(*) FILTER(WHERE result='ON_TIME')/NULLIF(count(*) FILTER(WHERE result<>'UNKNOWN'),0)) FROM all_cycle_results),
 'costs',(SELECT jsonb_build_object('total',sum(cost) FILTER(WHERE "costKnown"),'known',count(*) FILTER(WHERE "costKnown"),'unknown',count(*) FILTER(WHERE NOT "costKnown")) FROM costs),
 'vehicles',COALESCE((SELECT jsonb_agg(r ORDER BY problems DESC,incidents DESC,plate) FROM vehicle_rows r),'[]'),
 'categories',COALESCE((SELECT jsonb_agg(r ORDER BY total DESC,category) FROM (SELECT category,count(*) AS total,count(*) FILTER(WHERE priority='CRITICAL') AS critical FROM i GROUP BY category) r),'[]'),
 'recurrence',COALESCE((SELECT jsonb_agg(r ORDER BY repeats DESC,plate,problem) FROM (SELECT x."vehicleId",v.plate,x.problem,x.category,x.total,x.total-1 AS repeats FROM repeats x JOIN v ON v.id=x."vehicleId") r),'[]'),
 'costKinds',COALESCE((SELECT jsonb_agg(r ORDER BY kind) FROM (SELECT kind,sum(cost) FILTER(WHERE "costKnown") AS cost,count(*) FILTER(WHERE "costKnown") AS known,count(*) FILTER(WHERE NOT "costKnown") AS unknown FROM costs GROUP BY kind) r),'[]')
 ) AS report`);
 },{timeout:20000});
 return row.report;
}
