import test from 'node:test';
import assert from 'node:assert/strict';
import {createDriverInspectionSchema,type InspectionItem} from '../src/lib/driver-inspection';
import {checklistVehicleWhere} from '../src/lib/vehicle-checklist-link';
import {decodeChecklistPhoto,readLimitedBody} from '../src/lib/checklist-upload';
const inspectionItems:InspectionItem[]=[{id:'fixture-1',label:'Teste',help:'',group:'Pneus',category:'TIRES',priority:'HIGH',problems:['Desgaste','Outro'],requiresPhoto:true,generatesIncident:true,blocksVehicle:false,allowsNotApplicable:false}];
const driverInspectionSchema=createDriverInspectionSchema(inspectionItems);
const valid={driverIdentification:'M001',mileage:0,configVersion:'a'.repeat(64),submissionKey:'42a80ebf-788b-425c-b41f-ac8c3a641e70',answers:inspectionItems.map(i=>({item:i.id,answer:'OK'}))};
test('checklist usa o conjunto recebido e exige identificação, km e todos os itens',()=>{
  assert.equal(driverInspectionSchema.safeParse(valid).success,true);
  for(const patch of [{driverIdentification:' '},{driverIdentification:undefined},{mileage:-1},{mileage:1.2},{answers:valid.answers.slice(1)},{answers:[valid.answers[0],valid.answers[0]]},{answers:valid.answers.map(a=>({...a,item:'desconhecido'}))}])assert.equal(driverInspectionSchema.safeParse({...valid,...patch}).success,false);
});
test('regras recebidas permitem foto opcional e não se aplica apenas quando configurado',()=>{
 const optional=createDriverInspectionSchema([{...inspectionItems[0],requiresPhoto:false,allowsNotApplicable:true}]);
 assert.equal(optional.safeParse({...valid,answers:[{item:'fixture-1',answer:'ISSUE',problemType:'Desgaste'}]}).success,true);
 assert.equal(optional.safeParse({...valid,answers:[{item:'fixture-1',answer:'NOT_APPLICABLE'}]}).success,true);
 assert.equal(driverInspectionSchema.safeParse({...valid,answers:[{item:'fixture-1',answer:'NOT_APPLICABLE'}]}).success,false);
 assert.equal(createDriverInspectionSchema([]).safeParse({...valid,answers:[]}).success,false);
});
test('problema exige opção válida e foto; observação é opcional',()=>{
  const issue={item:inspectionItems[0].id,answer:'ISSUE',problemType:'Desgaste',photo:'data:image/jpeg;base64,/9j/2Q=='};
  const parse=(patch:object)=>driverInspectionSchema.safeParse({...valid,answers:[{...issue,...patch},...valid.answers.slice(1)]}).success;
  assert.equal(parse({}),true);
  for(const patch of [{photo:undefined},{problemType:undefined},{problemType:'Inventado'},{photo:'data:text/html;base64,abcd'},{answer:'OK'},{answer:'NOT_APPLICABLE'}])assert.equal(parse(patch),false);
});
test('links por placa e QR antigo; identificadores arbitrários rejeitados',()=>{
  assert.deepEqual(checklistVehicleWhere('QTO6479'),{plate:'QTO6479'});
  assert.deepEqual(checklistVehicleWhere('omn-6012'),{plate:'OMN6012'});
  assert.deepEqual(checklistVehicleWhere(valid.submissionKey),{qrToken:valid.submissionKey});
  assert.equal(checklistVehicleWhere('../frota'),null);
});
test('fotos e corpo HTTP inválidos são rejeitados antes de persistir',async()=>{
  assert.throws(()=>decodeChecklistPhoto('data:image/jpeg;base64,aHRtbA=='),/PHOTO/);
  const small=new Request('http://localhost',{method:'POST',body:'abc'});
  assert.equal(await readLimitedBody(small,3),'abc');
  await assert.rejects(()=>readLimitedBody(new Request('http://localhost',{method:'POST',body:'abcd'}),3),/TOO_LARGE/);
});
