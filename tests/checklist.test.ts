import test from 'node:test';
import assert from 'node:assert/strict';
import { checklistItems, checklistSchema, summarizeAnswers } from '../src/lib/checklist';
const valid = { driverName: 'Motorista Teste', mileage: 100, notes: '', submissionKey: '42a80ebf-788b-425c-b41f-ac8c3a641e70', answers: checklistItems.map(item => ({ item: item.id, answer: 'OK' })) };
test('aceita uma inspeção completa', () => assert.equal(checklistSchema.safeParse(valid).success, true));
test('rejeita itens ausentes ou duplicados', () => {
  assert.equal(checklistSchema.safeParse({ ...valid, answers: valid.answers.slice(1) }).success, false);
  assert.equal(checklistSchema.safeParse({ ...valid, answers: valid.answers.map(() => valid.answers[0]) }).success, false);
});
test('rejeita quilometragem negativa, resposta desconhecida e nome vazio', () => {
  for (const invalid of [{ mileage: -1 }, { mileage: 1.5 }, { driverName: ' ' }, { answers: valid.answers.map(a => ({ ...a, answer: 'MAYBE' })) }]) assert.equal(checklistSchema.safeParse({ ...valid, ...invalid }).success, false);
});
test('conformidade exclui itens não aplicáveis e arredonda para duas casas', () => {
  assert.deepEqual(summarizeAnswers([{ answer:'OK' },{ answer:'OK' },{ answer:'ISSUE' },{ answer:'NOT_APPLICABLE' }]), { hasProblem:true, conformityPercentage:66.67, result:'ISSUE' });
  assert.deepEqual(summarizeAnswers([{ answer:'NOT_APPLICABLE' }]), { hasProblem:false, conformityPercentage:null, result:'NOT_EVALUATED' });
});
test('localização opcional exige latitude e longitude válidas', () => {
  assert.equal(checklistSchema.safeParse({ ...valid, location:{ latitude:-12.9,longitude:-38.5,accuracy:10 } }).success,true);
  for (const location of [{ latitude:91,longitude:0 },{ latitude:0,longitude:181 },{ latitude:0 },{ latitude:0,longitude:0,accuracy:-1 }]) assert.equal(checklistSchema.safeParse({ ...valid, location }).success,false);
});
