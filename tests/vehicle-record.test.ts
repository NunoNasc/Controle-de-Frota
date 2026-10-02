import test from 'node:test';
import assert from 'node:assert/strict';
import {vehicleRecordWhere,displayPlate,safeDocumentUrl,fuelSchema} from '../src/lib/vehicle-record';
test('ficha aceita placa normalizada e preserva links por ID',()=>{
 assert.deepEqual(vehicleRecordWhere('qto-6479'),{plate:'QTO6479'});
 assert.deepEqual(vehicleRecordWhere('legacy-id'),{id:'legacy-id'});
 assert.equal(displayPlate('QTO6479'),'QTO-6479');
 assert.equal(displayPlate('ABC1D23'),'ABC1D23');
});
test('documentos rejeitam protocolos executáveis e URLs relativas de outra origem',()=>{
 for(const url of ['javascript:alert(1)','data:text/html,test','//example.com','/\\example.com'])assert.equal(safeDocumentUrl(url),null);
 assert.equal(safeDocumentUrl('/documentos/arquivo.pdf'),'/documentos/arquivo.pdf');
 assert.equal(safeDocumentUrl('https://example.com/a.pdf'),'https://example.com/a.pdf');
});
test('abastecimento exige identificação, quantidades e precisão válidas',()=>{
 const data={vehicleId:'v1',submissionKey:crypto.randomUUID(),fueledAt:new Date().toISOString(),mileage:100,fuelType:'DIESEL',liters:10.123,amount:100.12,station:'',notes:'',operatorName:'Analista',operatorId:'123'};
 assert.equal(fuelSchema.safeParse(data).success,true);
 for(const change of [{mileage:-1},{liters:0},{liters:1.2345},{amount:-1},{amount:1.234},{operatorId:''},{fuelType:'INVALID'}])assert.equal(fuelSchema.safeParse({...data,...change}).success,false);
});
