import test from 'node:test';
import assert from 'node:assert/strict';
import {mileageConcern} from '../src/lib/mileage-validation';
test('KM sem base, igual e aumento usual não exigem confirmação extra',()=>{
  assert.equal(mileageConcern(50000,null),null);
  assert.equal(mileageConcern(0,0),null);
  assert.equal(mileageConcern(51000,50000),null);
});
test('leitura inferior e aumento acima de mil quilômetros exigem conferência',()=>{
  assert.equal(mileageConcern(49999,50000),'LOWER');
  assert.equal(mileageConcern(51001,50000),'JUMP');
});
