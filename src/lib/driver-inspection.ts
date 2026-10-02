import {z} from 'zod';
import type {InspectionCategory,Priority} from '@prisma/client';
export type InspectionItem = {id:string;label:string;help:string;group:string;category:InspectionCategory;priority:Priority;problems:string[];requiresPhoto:boolean;generatesIncident:boolean;blocksVehicle:boolean;allowsNotApplicable:boolean};
export const MAX_PHOTO_BYTES=450_000;
export const driverPayloadSchema=z.object({
 driverIdentification:z.string().trim().min(1).max(100),mileage:z.number().int().min(0).max(9_999_999),submissionKey:z.uuid(),configVersion:z.string().length(64),
 mileageConfirmedAgainst:z.number().int().min(0).max(9_999_999).optional(),
 answers:z.array(z.object({item:z.string().min(1).max(100),answer:z.enum(['OK','ISSUE','NOT_APPLICABLE']),problemType:z.string().max(100).optional(),notes:z.string().trim().max(2000).default(''),photo:z.string().max(600_024).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/).optional()})).min(1).max(100),
});
export type InspectionAnswer=z.infer<typeof driverPayloadSchema>['answers'][number];
export function answerComplete(item:InspectionItem,answer?:InspectionAnswer){
 if(!answer)return false;
 if(answer.answer==='NOT_APPLICABLE')return item.allowsNotApplicable;
 return answer.answer==='OK'||!!(answer.problemType&&item.problems.includes(answer.problemType)&&(!item.requiresPhoto||answer.photo));
}
export function createDriverInspectionSchema(items:InspectionItem[]){
 return driverPayloadSchema.superRefine((value,ctx)=>{
  if(!items.length||value.answers.length!==items.length||new Set(value.answers.map(a=>a.item)).size!==items.length)ctx.addIssue({code:'custom',message:'Responda todos os itens uma única vez.'});
  value.answers.forEach((answer,index)=>{
   const item=items.find(i=>i.id===answer.item);
   if(!item||!answerComplete(item,answer))ctx.addIssue({code:'custom',path:['answers',index],message:'Confira o item, o tipo de problema e a foto exigida.'});
   if(answer.answer!=='ISSUE'&&(answer.problemType||answer.photo||answer.notes))ctx.addIssue({code:'custom',path:['answers',index],message:'Somente problemas devem conter detalhes.'});
  });
 });
}
