'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {Maximize,Minimize,RefreshCw,Truck} from 'lucide-react';
import type {OperationalPanelData} from '@/lib/operational-panel';
import './operational-panel.css';
const REFRESH_MS=30_000;
function age(value:string,now:number){const minutes=Math.max(0,Math.floor((now-Date.parse(value))/60000));return minutes<60?`${minutes} min`:minutes<1440?`${Math.floor(minutes/60)} h`:`${Math.floor(minutes/1440)} d ${Math.floor(minutes%1440/60)} h`;}
export function OperationalPanel({initialData}:{initialData:OperationalPanelData|null}){
 const [data,setData]=useState(initialData),[clock,setClock]=useState(initialData?Date.parse(initialData.updatedAt):0);
 const [busy,setBusy]=useState(false),[error,setError]=useState(initialData?'':'Dados ainda não disponíveis. Tentando conectar…');
 const [fullscreen,setFullscreen]=useState(false),[screenError,setScreenError]=useState('');
 const root=useRef<HTMLElement>(null),request=useRef<AbortController|null>(null),mounted=useRef(false);
 const refresh=useCallback(async()=>{
  if(request.current)return;
  const controller=new AbortController();request.current=controller;setBusy(true);
  const timeout=setTimeout(()=>controller.abort(),20_000);
  try{
   const response=await fetch('/api/admin/operational-panel',{cache:'no-store',signal:controller.signal});
   if(!response.ok)throw new Error('FETCH');
   const next:OperationalPanelData=await response.json();
   if(mounted.current&&request.current===controller){setData(next);setError('');setClock(Date.now());}
  }catch{if(mounted.current&&request.current===controller)setError('Sem atualização. Verifique a conexão; os dados exibidos podem estar desatualizados.');}
  finally{clearTimeout(timeout);if(request.current===controller){request.current=null;if(mounted.current)setBusy(false);}}
 },[]);
 useEffect(()=>{
  mounted.current=true;const clockTimer=setInterval(()=>setClock(Date.now()),1000);
  const poll=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},REFRESH_MS);
  const visible=()=>{if(document.visibilityState==='visible')void refresh();};
  const online=()=>void refresh();const offline=()=>setError('Sem conexão. Os dados exibidos podem estar desatualizados.');
  const changed=()=>setFullscreen(document.fullscreenElement===root.current);
  document.addEventListener('visibilitychange',visible);document.addEventListener('fullscreenchange',changed);
  window.addEventListener('online',online);window.addEventListener('offline',offline);
  const initialRetry=!initialData?setTimeout(()=>void refresh(),0):undefined;
  return()=>{mounted.current=false;clearTimeout(initialRetry);clearInterval(clockTimer);clearInterval(poll);request.current?.abort();request.current=null;document.removeEventListener('visibilitychange',visible);document.removeEventListener('fullscreenchange',changed);window.removeEventListener('online',online);window.removeEventListener('offline',offline);};
 },[refresh,initialData]);
 async function toggleFullscreen(){
  setScreenError('');try{if(document.fullscreenElement)await document.exitFullscreen();else if(root.current?.requestFullscreen)await root.current.requestFullscreen();else setScreenError('Tela cheia indisponível neste navegador. Use F11 no computador.');}catch{setScreenError('Não foi possível entrar em tela cheia. Use F11 no computador.');}
 }
 const stale=!!error||!!(data&&clock-Date.parse(data.updatedAt)>65_000);
 const number=(value:number|undefined)=>value===undefined?'—':value.toLocaleString('pt-BR');
 const cards=[
  {label:'VEÍCULOS PARADOS',value:data?.stopped,note:'Indisponíveis ou com restrição',href:'/frota',danger:(data?.stopped??0)>0},
  {label:'ALERTAS CRÍTICOS',value:data?.criticalCount,note:'Pendentes de tratamento',href:'/alertas?priority=CRITICAL',danger:(data?.criticalCount??0)>0},
  {label:'MANUTENÇÕES EM ANDAMENTO',value:data?.maintenance,note:'Em manutenção ou teste',href:'/manutencoes',danger:false},
  {label:'CHECKLISTS COM PROBLEMA',value:data?.checklists,note:'Enviados e aguardando revisão',href:'/checklists',danger:false},
  {label:'PREVENTIVAS VENCIDAS',value:data?.overdue,note:'Veículos · data ou KM com tolerância',href:'/preventivas',danger:(data?.overdue??0)>0},
  {label:'OCORRÊNCIAS SEM RESPONSÁVEL',value:data?.unassignedCount,note:'Ocorrências abertas',href:'/ocorrencias',danger:(data?.unassignedCount??0)>0},
 ];
 return <main ref={root} className="tv-panel"><header className="tv-header"><div className="tv-brand"><Truck size={30}/><div><span>CENTRAL DE CONTROLE DE FROTA</span><h1>Painel Operacional</h1></div></div><div className="tv-clock" aria-label="Relógio de Brasília"><strong>{clock?new Date(clock).toLocaleTimeString('pt-BR',{timeZone:'America/Bahia'}):'—'}</strong><span>{clock?new Date(clock).toLocaleDateString('pt-BR',{timeZone:'America/Bahia',weekday:'long',day:'2-digit',month:'long',year:'numeric'}):'Aguardando relógio'}</span></div><div className="tv-controls"><button onClick={()=>void refresh()} disabled={busy}><RefreshCw size={18}/>{busy?'Atualizando…':'Atualizar'}</button><button onClick={()=>void toggleFullscreen()}>{fullscreen?<Minimize size={18}/>:<Maximize size={18}/>}<span>{fullscreen?'Sair da tela cheia':'Tela cheia'}</span></button><Link href="/">Voltar à gestão</Link></div></header>
 <div className={`tv-freshness ${stale?'tv-stale':''}`} role="status"><span>{stale?'ATENÇÃO · DADOS SEM ATUALIZAÇÃO':data?'ATUALIZAÇÃO AUTOMÁTICA · 30 SEGUNDOS':'CONECTANDO AO PAINEL'}</span><p>Última atualização: {data?<time dateTime={data.updatedAt}>{new Date(data.updatedAt).toLocaleString('pt-BR',{timeZone:'America/Bahia'})}</time>:'nenhuma atualização confirmada'}</p></div>
 {stale&&<p className="tv-error" role="alert">{error||'A última atualização tem mais de 65 segundos. Confira a conexão.'}</p>}{screenError&&<p className="tv-error" role="alert">{screenError}</p>}
 <section className="tv-metrics" aria-label="Indicadores operacionais"><Link className="tv-metric tv-availability" href="/indicadores"><h2>DISPONIBILIDADE</h2><strong data-tv="DISPONIBILIDADE">{!data?'—':data.fleet.availability===null?'Sem base':`${data.fleet.availability.toLocaleString('pt-BR',{maximumFractionDigits:1})}%`}</strong><p>{data?`${data.fleet.available} aptos / ${data.fleet.total} veículos ativos`:'Aguardando dados'}</p><small>{data?.fleet.unknown?`${data.fleet.unknown} veículo(s) sem situação completa`:'Inclui veículos em uso aptos para operação'}</small></Link>{cards.map(c=><Link href={c.href} key={c.label} className={`tv-metric ${c.danger?'tv-danger':''}`}><h2>{c.label}</h2><strong data-tv={c.label}>{number(c.value)}</strong><p>{c.note}</p></Link>)}</section>
 <div className="tv-queues"><section className={`tv-queue ${data?.criticalCount?'tv-critical-queue':''}`}><div className="tv-queue-title"><h2>PRIORIDADE IMEDIATA</h2><span>{number(data?.criticalCount)} crítico(s)</span></div>{data?.critical.length?<ul>{data.critical.map(a=><li key={a.id}><Link href={`/alertas/${a.id}`}><span className="tv-plate">{a.plate}</span><span className="tv-problem"><strong>{a.title}</strong><small>{a.responsible}</small></span><span className="tv-age">{age(a.openedAt,clock)}<small>aguardando</small></span></Link></li>)}</ul>:<p className="tv-empty">{data?'Nenhum alerta crítico pendente.':'Aguardando dados do banco.'}</p>}<p className="tv-queue-note">{data&&data.criticalCount>4?`Mostrando os 4 mais antigos de ${data.criticalCount}. `:''}Consulte todos os alertas na Central de Alertas.</p></section>
 <section className="tv-queue"><div className="tv-queue-title"><h2>ATRIBUIR RESPONSÁVEL</h2><span>{number(data?.unassignedCount)} pendente(s)</span></div>{data?.unassigned.length?<ul>{data.unassigned.map(i=><li key={i.id} className={i.priority==='CRITICAL'?'tv-critical-row':''}><Link href={`/ocorrencias/${i.id}`}><span className="tv-plate">{i.plate}</span><span className="tv-problem"><strong>{i.title}</strong><small>{i.priority==='CRITICAL'?'CRÍTICA · ':''}{i.number}</small></span><span className="tv-age">{age(i.openedAt,clock)}<small>em aberto</small></span></Link></li>)}</ul>:<p className="tv-empty">{data?'Todas as ocorrências abertas têm responsável.':'Aguardando dados do banco.'}</p>}<p className="tv-queue-note">{data&&data.unassignedCount>4?`Mostrando 4 de ${data.unassignedCount}. `:''}Ordenadas por criticidade e tempo de abertura.</p></section></div>
 <footer className="tv-footer">Posição atual · America/Bahia · painel administrativo · Esc sai da tela cheia</footer>
 </main>;
}
