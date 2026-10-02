import test from 'node:test';
import assert from 'node:assert/strict';
import {restrictionDecisionSchema,validateRestrictionDecision,parseRestrictionPolicy} from '../src/lib/restrictions';
const raw={operatorName:'Avaliador teste',operatorId:'QA',revision:0,decision:'BLOCKED',notes:'Avaliação técnica registrada'};
const record={state:'AWAITING_ASSESSMENT',revision:0,releaseEvidenceRequired:true};
test('decisão exige responsável e observação; configuração inválida usa regra conservadora',()=>{
 assert.equal(restrictionDecisionSchema.safeParse({...raw,operatorName:''}).success,false);
 assert.equal(restrictionDecisionSchema.safeParse({...raw,operatorId:''}).success,false);
 assert.equal(restrictionDecisionSchema.safeParse({...raw,notes:''}).success,false);
 assert.deepEqual(parseRestrictionPolicy(null),{initialState:'AWAITING_ASSESSMENT',releaseEvidenceRequired:true});
});
test('liberação exige solução e evidência apenas quando configurada',()=>{
 assert.throws(()=>validateRestrictionDecision(record,restrictionDecisionSchema.parse({...raw,decision:'RELEASED'})),/solução/);
 const release=restrictionDecisionSchema.parse({...raw,decision:'RELEASED',solution:'Reparo realizado'});
 assert.throws(()=>validateRestrictionDecision(record,release),/evidência/);
 assert.doesNotThrow(()=>validateRestrictionDecision({...record,releaseEvidenceRequired:false},release));
 assert.doesNotThrow(()=>validateRestrictionDecision(record,restrictionDecisionSchema.parse(raw)));
});
test('revisão desatualizada e restrição liberada não podem ser alteradas',()=>{
 assert.throws(()=>validateRestrictionDecision({...record,revision:1},restrictionDecisionSchema.parse(raw)),/STALE/);
 assert.throws(()=>validateRestrictionDecision({...record,state:'RELEASED'},restrictionDecisionSchema.parse(raw)),/já foi liberada/);
});
