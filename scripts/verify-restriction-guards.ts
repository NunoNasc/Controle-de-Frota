import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
const db=new PrismaClient();
async function main(){
 const before=await db.vehicle.count();
 await assert.rejects(db.$transaction(async tx=>{
  const vehicle=await tx.vehicle.create({data:{plate:`QA-${crypto.randomUUID()}`,model:'Teste transacional',category:'Teste',year:2020}});
  const restriction=await tx.vehicleRestriction.create({data:{vehicleId:vehicle.id,reason:'Teste de evidência obrigatória',releaseEvidenceRequired:true}});
  await tx.$queryRaw`SELECT set_config('fleet.actor','Teste transacional',true),set_config('fleet.solution','Solução de teste',true),set_config('fleet.notes','Observação de teste',true)`;
  await tx.vehicleRestriction.update({where:{id:restriction.id},data:{state:'RELEASED'}});
  // No evidence is written: the deferred database constraint must reject the commit.
 }),/Release evidence is required/);
 assert.equal(await db.vehicle.count(),before);
 console.log('PASS: banco rejeita liberação sem evidência obrigatória mesmo fora da API; toda a transação foi revertida.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>db.$disconnect());
