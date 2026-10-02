import {adminUnavailable} from '@/lib/admin-boundary';
import {getOperationalPanel} from '@/lib/operational-panel';
export const dynamic='force-dynamic';
export async function GET(){
 const headers={'Cache-Control':'private, no-store, max-age=0'};
 if(adminUnavailable())return Response.json({error:'Acesso administrativo indisponível.'},{status:403,headers});
 try{return Response.json(await getOperationalPanel(),{headers});}
 catch{ return Response.json({error:'Não foi possível atualizar o painel.'},{status:503,headers}); }
}
