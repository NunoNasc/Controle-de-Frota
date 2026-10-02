import {z} from 'zod';
export const configItemSchema=z.object({
 id:z.string().min(1).optional(),updatedAt:z.string().datetime().optional(),categoryId:z.string().min(1).max(100),
 label:z.string().trim().min(2).max(120),help:z.string().trim().max(300).default(''),
 problems:z.array(z.string().trim().min(1).max(100)).min(1).max(20).refine(a=>new Set(a.map(p=>p.toLocaleLowerCase('pt-BR'))).size===a.length,'Não repita opções de problema.'),
 priority:z.enum(['LOW','MEDIUM','HIGH','CRITICAL']),requiresPhoto:z.boolean(),generatesIncident:z.boolean(),blocksVehicle:z.boolean(),allowsNotApplicable:z.boolean(),active:z.boolean(),
 vehicleTypes:z.array(z.string().trim().min(1).max(100)).max(50).refine(a=>new Set(a).size===a.length),sortOrder:z.number().int().min(0).max(9999),
});
