import { z } from 'zod';
export const checklistItems = [
  { id: 'tires', category: 'TIRES', priority: 'HIGH', label: 'Pneus e rodas', help: 'Confira a calibragem aparente e danos nos pneus.' },
  { id: 'lights', category: 'LIGHTING', priority: 'HIGH', label: 'Luzes e sinalização', help: 'Teste faróis, lanternas, setas e luz de freio.' },
  { id: 'brakes', category: 'BRAKES', priority: 'CRITICAL', label: 'Freios', help: 'Verifique o funcionamento e ruídos anormais.' },
  { id: 'fluids', category: 'FLUIDS', priority: 'HIGH', label: 'Óleo e fluidos', help: 'Confira os níveis e se há vazamentos.' },
  { id: 'safety', category: 'SAFETY', priority: 'HIGH', label: 'Itens de segurança', help: 'Confira cinto, triângulo e demais itens obrigatórios.' },
  { id: 'body', category: 'BODY', priority: 'HIGH', label: 'Lataria e espelhos', help: 'Observe avarias, para-brisa e retrovisores.' },
] as const;
export const checklistSchema = z.object({
  driverName: z.string().trim().min(3).max(100),
  driverId: z.string().min(1).max(100).optional(),
  type: z.enum(['PRE_TRIP', 'POST_TRIP', 'PERIODIC', 'EXTRAORDINARY']).default('PRE_TRIP'),
  location: z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), accuracy: z.number().min(0).max(99999999).optional(), label: z.string().trim().max(250).optional() }).optional(),
  mileage: z.number().int().min(0).max(9999999),
  notes: z.string().trim().max(2000),
  submissionKey: z.uuid(),
  answers: z.array(z.object({ item: z.enum(checklistItems.map(i => i.id)), answer: z.enum(['OK', 'ISSUE', 'NOT_APPLICABLE']), notes: z.string().trim().max(2000).default('') })).length(checklistItems.length),
}).refine(value => new Set(value.answers.map(a => a.item)).size === checklistItems.length, 'Responda todos os itens uma única vez.');

export function summarizeAnswers(answers: ReadonlyArray<{ answer: string }>) {
  const applicable = answers.filter(a => a.answer !== 'NOT_APPLICABLE');
  const hasProblem = applicable.some(a => a.answer === 'ISSUE');
  const conformityPercentage = applicable.length ? Math.round(applicable.filter(a => a.answer === 'OK').length / applicable.length * 10000) / 100 : null;
  const result = applicable.length === 0 ? 'NOT_EVALUATED' : hasProblem ? 'ISSUE' : 'OK';
  return { hasProblem, conformityPercentage, result } as const;
}
