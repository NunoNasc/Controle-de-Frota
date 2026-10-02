// A warning threshold, not a maximum allowed distance between inspections.
export const MILEAGE_JUMP_WARNING_KM = 1_000;
export function mileageConcern(current:number, previous:number|null) {
  if (previous === null) return null;
  if (current < previous) return 'LOWER' as const;
  if (current - previous > MILEAGE_JUMP_WARNING_KM) return 'JUMP' as const;
  return null;
}
