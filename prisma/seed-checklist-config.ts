import {PrismaClient, type InspectionCategory, type Priority} from '@prisma/client';
const groups: {code:string;name:string;category:InspectionCategory;items:string[]}[] = [
 {code:'documentation',name:'DOCUMENTAÇÃO',category:'OTHER',items:['Documento do veículo']},
 {code:'tires',name:'PNEUS',category:'TIRES',items:['Dianteiro esquerdo','Dianteiro direito','Traseiros','Estepe','Pressão / aparência','Desgaste','Cortes / avarias']},
 {code:'lighting',name:'ILUMINAÇÃO',category:'LIGHTING',items:['Faróis','Lanternas','Luz de freio','Setas','Luz de ré']},
 {code:'safety',name:'SEGURANÇA',category:'SAFETY',items:['Cinto','Buzina','Retrovisores','Extintor','Triângulo','Equipamentos obrigatórios']},
 {code:'engine',name:'MOTOR',category:'FLUIDS',items:['Nível de óleo','Vazamento de óleo','Ruídos anormais','Fumaça anormal']},
 {code:'cooling',name:'ARREFECIMENTO',category:'FLUIDS',items:['Nível','Vazamentos','Temperatura']},
 {code:'brakes',name:'FREIOS',category:'BRAKES',items:['Funcionamento','Ruído','Luz de advertência']},
 {code:'steering',name:'DIREÇÃO',category:'OTHER',items:['Folga','Ruídos','Funcionamento']},
 {code:'cabin',name:'CABINE',category:'BODY',items:['Painel','Indicadores','Limpador','Para-brisa','Bancos']},
 {code:'body',name:'CARROCERIA',category:'BODY',items:['Avarias','Portas','Para-choques']},
];
const options:Record<string,string[]>={documentation:['Ausente','Vencido','Ilegível','Outro'],tires:['Desgaste','Corte','Baixa pressão','Pneu furado','Ausente','Outro'],lighting:['Não acende','Quebrado','Intermitente','Outro'],safety:['Ausente','Danificado','Não funciona','Vencido','Outro'],engine:['Nível baixo','Vazamento','Ruído anormal','Fumaça anormal','Alerta no painel','Outro'],cooling:['Nível baixo','Vazamento','Temperatura elevada','Outro'],brakes:['Baixa eficiência','Ruído anormal','Luz acesa','Vazamento de ar','Outro'],steering:['Folga excessiva','Ruído anormal','Direção pesada','Outro'],cabin:['Não funciona','Danificado','Alerta no painel','Outro'],body:['Amassado','Quebrado','Solto','Fechamento danificado','Outro']};
/** Bootstrap only: empty updates preserve every administrative customization and inactive item. */
export async function seedChecklistConfig(db:PrismaClient){
 await db.$transaction(async tx=>{
  for(const [sortOrder,group] of groups.entries()){
   const category=await tx.checklistCategory.upsert({where:{code:group.code},update:{},create:{id:`category-${group.code}`,code:group.code,name:group.name,sortOrder,inspectionCategory:group.category}});
   for(const [index,label] of group.items.entries()){
    const blocking=['brakes','steering'].includes(group.code);const priority:Priority=blocking?'CRITICAL':group.code==='cabin'||group.code==='body'?'MEDIUM':'HIGH';
    await tx.checklistItemConfig.upsert({where:{id:`config-${group.code}-${index+1}`},update:{},create:{id:`config-${group.code}-${index+1}`,categoryId:category.id,label,sortOrder:index,priority,problems:options[group.code],requiresPhoto:true,generatesIncident:true,blocksVehicle:blocking,allowsNotApplicable:group.code==='documentation'||label==='Extintor',vehicleTypes:[],help:group.code==='cooling'?'Confira visualmente. Não abra o reservatório quente.':''}});
   }
  }
 });
}
