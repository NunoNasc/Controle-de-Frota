import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateNegativeAnswer} from '../src/lib/criticality-engine';
import type {InspectionItem} from '../src/lib/driver-inspection';
const rule:InspectionItem={id:'a',label:'Item configurável',help:'',group:'Categoria',category:'OTHER',priority:'MEDIUM',problems:['Falha'],requiresPhoto:false,generatesIncident:false,blocksVehicle:false,allowsNotApplicable:true};
test('motor ignora OK e não se aplica; não usa palavras-chave para inventar gravidade',()=>{
 for(const answer of ['OK','NOT_APPLICABLE'] as const)assert.equal(evaluateNegativeAnswer({item:'a',answer},rule),null);
 const d=evaluateNegativeAnswer({item:'a',answer:'ISSUE',problemType:'Falha'},{...rule,label:'Freio superaquecimento grave'})!;assert.equal(d.priority,'MEDIUM');assert.equal(d.createsAlert,true);
});
test('todas as criticidades e combinações de ocorrência/bloqueio seguem a configuração',()=>{
 for(const priority of ['LOW','MEDIUM','HIGH','CRITICAL'] as const)for(const generatesIncident of [false,true])for(const blocksVehicle of [false,true]){
  const d=evaluateNegativeAnswer({item:'a',answer:'ISSUE',problemType:'Falha'},{...rule,priority,generatesIncident,blocksVehicle})!;
  assert.equal(d.priority,priority);assert.equal(d.createsIncident,generatesIncident);assert.equal(d.blocksVehicle,blocksVehicle);assert.equal(d.createsAlert,true);assert.equal(d.ruleSnapshot.priority,priority);
 }
});
test('regra incorreta ou opção inválida falha de forma explícita',()=>{
 assert.throws(()=>evaluateNegativeAnswer({item:'b',answer:'ISSUE',problemType:'Falha'},rule),/RULE_MISMATCH/);
 assert.throws(()=>evaluateNegativeAnswer({item:'a',answer:'ISSUE',problemType:'Inventado'},rule),/INVALID_PROBLEM/);
});
