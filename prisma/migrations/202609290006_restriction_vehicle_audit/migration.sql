-- Record the resulting fleet state in each decision, including releases without an incident.
CREATE OR REPLACE FUNCTION audit_restriction() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE op "OperationalStatus"; previous "Vehicle"%ROWTYPE; current_vehicle "Vehicle"%ROWTYPE; target_status "VehicleStatus"; target_availability "Availability"; requested text;
BEGIN
 SELECT * INTO previous FROM "Vehicle" WHERE id=NEW."vehicleId";
 SELECT CASE WHEN bool_or(state='BLOCKED') THEN 'BLOCKED' WHEN bool_or(state='AWAITING_ASSESSMENT') THEN 'AWAITING_ASSESSMENT' ELSE 'CLEAR' END::"OperationalStatus" INTO op FROM "VehicleRestriction" WHERE "vehicleId"=NEW."vehicleId" AND state<>'RELEASED';
 target_status:=previous.status; target_availability:=previous.availability;
 IF op<>'CLEAR' THEN target_status:='STOPPED'; target_availability:='UNAVAILABLE';
 ELSIF NEW.state='RELEASED' THEN
  requested:=NULLIF(current_setting('fleet.post_release_status',true),'');
  IF requested IS NOT NULL THEN
   IF requested NOT IN ('AVAILABLE','MAINTENANCE','STOPPED','UNKNOWN') THEN RAISE EXCEPTION 'Invalid post release status'; END IF;
   IF requested='AVAILABLE' AND (NOT previous.active OR previous.status='INACTIVE' OR EXISTS(SELECT 1 FROM "Maintenance" WHERE "vehicleId"=NEW."vehicleId" AND status IN ('OPEN','IN_PROGRESS'))) THEN RAISE EXCEPTION 'Vehicle cannot be made available'; END IF;
   target_status:=requested::"VehicleStatus";
   target_availability:=CASE requested WHEN 'AVAILABLE' THEN 'AVAILABLE' WHEN 'UNKNOWN' THEN 'UNKNOWN' ELSE 'UNAVAILABLE' END::"Availability";
  END IF;
 END IF;
 UPDATE "Vehicle" SET "operationalStatus"=op,status=target_status,availability=target_availability,"updatedAt"=clock_timestamp() AT TIME ZONE 'UTC' WHERE id=NEW."vehicleId" RETURNING * INTO current_vehicle;
 INSERT INTO "RestrictionEvent"(id,"restrictionId",actor,decision,solution,notes,"before","after") VALUES(
 gen_random_uuid()::text,NEW.id,COALESCE(NULLIF(current_setting('fleet.actor',true),''),'Sistema'),NEW.state,
 COALESCE(current_setting('fleet.solution',true),''),COALESCE(NULLIF(current_setting('fleet.notes',true),''),'Restrição registrada pela regra configurada do checklist.'),
 CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
 to_jsonb(NEW)||jsonb_build_object('vehicleStatusBefore',previous.status,'vehicleStatusAfter',current_vehicle.status,'operationalStatusBefore',previous."operationalStatus",'operationalStatusAfter',current_vehicle."operationalStatus",'availabilityBefore',previous.availability,'availabilityAfter',current_vehicle.availability));
 RETURN NEW;
END $$;
