-- Deferred until commit: the audit event and its evidence are written atomically with the release.
CREATE FUNCTION require_release_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.state='RELEASED' AND NEW."releaseEvidenceRequired" AND NOT EXISTS (
  SELECT 1 FROM "RestrictionEvent" e JOIN "RestrictionEvidence" f ON f."eventId"=e.id WHERE e."restrictionId"=NEW.id AND e.decision='RELEASED'
 ) THEN RAISE EXCEPTION 'Release evidence is required'; END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER require_release_evidence AFTER INSERT OR UPDATE ON "VehicleRestriction" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION require_release_evidence();
