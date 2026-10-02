import test from 'node:test';
import assert from 'node:assert/strict';
import {checklistQrUrl,qrLocalOnly,qrFingerprint,qrRotationSchema} from '../src/lib/vehicle-qr';
import {checklistSubmissionWhere,checklistVehicleWhere} from '../src/lib/vehicle-checklist-link';
import {adminUnavailable} from '../src/lib/admin-boundary';
test('placa identifica, mas nunca autoriza o envio; UUID legado e token de 256 bits são aceitos',()=>{
 assert.deepEqual(checklistVehicleWhere('QTO6479'),{plate:'QTO6479'});assert.equal(checklistSubmissionWhere('QTO6479'),null);
 for(const token of [crypto.randomUUID(),'a'.repeat(64)])assert.deepEqual(checklistSubmissionWhere(token),{qrToken:token});
 for(const token of ['-'.repeat(36),'a'.repeat(63),'../frota','cuid-legado'])assert.equal(checklistSubmissionWhere(token),null);
});
test('URL usa a origem configurada e não aceita credenciais, query ou protocolo executável',()=>{
 assert.equal(checklistQrUrl('a'.repeat(64),'https://frota.example.com'),`https://frota.example.com/checklist/${'a'.repeat(64)}`);
 for(const origin of ['javascript:alert(1)','https://user:secret@example.com','https://example.com?token=123','https://example.com/frota'])assert.throws(()=>checklistQrUrl('token',origin));
 assert.equal(qrLocalOnly('http://127.0.0.1:3000/checklist/test'),true);assert.equal(qrLocalOnly('https://frota.example.com/checklist/test'),false);
 assert.equal(qrFingerprint('secret').length,64);assert.notEqual(qrFingerprint('secret'),qrFingerprint('new-secret'));
});
test('regeneração exige revisão, identificação, motivo e ciência da invalidação',()=>{
 const data={revision:0,operatorName:'Analista',operatorId:'123',reason:'Substituição da etiqueta',acknowledged:true};assert.equal(qrRotationSchema.safeParse(data).success,true);
 for(const patch of [{revision:-1},{operatorId:''},{reason:''},{acknowledged:false}])assert.equal(qrRotationSchema.safeParse({...data,...patch}).success,false);
});
test('token não é mecanismo de autenticação administrativa',()=>{
 const old=process.env.ALLOW_DEV_ADMIN;process.env.ALLOW_DEV_ADMIN='false';try{assert.equal(adminUnavailable(),true);}finally{if(old===undefined)delete process.env.ALLOW_DEV_ADMIN;else process.env.ALLOW_DEV_ADMIN=old;}
});
