import {adminUnavailable} from '@/lib/admin-boundary';
import {getOperationalPanel} from '@/lib/operational-panel';
import {OperationalPanel} from '@/components/operational-panel';
export const dynamic='force-dynamic';
export const metadata={title:'Painel Operacional',robots:{index:false,follow:false}};
export default async function PanelPage(){
 if(adminUnavailable())return <main className="access-notice"><h1>Acesso administrativo indisponível</h1></main>;
 let data=null;
 try{data=await getOperationalPanel();}catch{/* The display can recover automatically without reloading the page. */}
 return <OperationalPanel initialData={data}/>;
}
