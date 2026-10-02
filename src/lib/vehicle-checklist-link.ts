/** A plate identifies a vehicle for display only. Submission always requires an opaque credential. */
export function isChecklistToken(value:string){return /^[a-f0-9]{64}$/.test(value)||/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);}
export function checklistSubmissionWhere(value:string){return isChecklistToken(value)?{qrToken:value}:null;}
export function checklistVehicleWhere(value:string) {
  if (isChecklistToken(value)) return {qrToken:value};
  const plate = value.toUpperCase().replace('-', '');
  if (/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate)) return {plate};
  return null;
}
