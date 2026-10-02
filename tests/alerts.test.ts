import test from 'node:test';
import assert from 'node:assert/strict';
import {alertSourceTransition,alertUpdateSchema,validateAlertUpdate,isAlertOpen} from '../src/lib/alerts';
test('tratamento não reabre pela atualização da mesma condição',()=>{
 for(const stage of ['RESOLVED','HANDLED','NOT_APPLICABLE','RULE_CLOSED'])assert.equal(alertSourceTransition({stage,sourceActive:true,priority:'HIGH'},true,'HIGH'),undefined);
 assert.equal(alertSourceTransition({stage:'IN_PROGRESS',sourceActive:true,priority:'HIGH'},true,'HIGH'),undefined);
});
test('recorrência e agravamento reabrem; regra encerra somente fila ativa',()=>{
 assert.equal(alertSourceTransition({stage:'HANDLED',sourceActive:false,priority:'HIGH'},true,'HIGH'),'NEW');
 assert.equal(alertSourceTransition({stage:'HANDLED',sourceActive:true,priority:'HIGH'},true,'CRITICAL'),'NEW');
 assert.equal(alertSourceTransition({stage:'NEW',sourceActive:true,priority:'HIGH'},false,'LOW'),'RULE_CLOSED');
 assert.equal(alertSourceTransition({stage:'NOT_APPLICABLE',sourceActive:true,priority:'HIGH'},false,'LOW'),undefined);
 assert.equal(isAlertOpen('RESOLVED'),false);
});
test('atendimento exige motivo, identidade e responsável; regra não pode ser forjada',()=>{
 const data={revision:0,stage:'HANDLED' as const,responsibleId:null,actionRequired:'Avaliar origem',note:'Atendimento realizado',operatorName:'Analista',operatorId:'123'};
 assert.equal(alertUpdateSchema.safeParse({...data,note:''}).success,false);
 assert.equal(alertUpdateSchema.safeParse({...data,operatorId:''}).success,false);
 assert.throws(()=>validateAlertUpdate({stage:'NEW'},data),/responsável/);
 assert.throws(()=>validateAlertUpdate({stage:'NEW'},{...data,stage:'RULE_CLOSED'}),/automático/);
 assert.doesNotThrow(()=>validateAlertUpdate({stage:'NEW'},{...data,responsibleId:'staff'}));
});
