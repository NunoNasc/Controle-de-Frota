'use client';
import Image from 'next/image';
import {RestrictionBanner} from './restriction-banner';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, Check, CheckCircle2, Pencil, Send, Truck, X } from 'lucide-react';
import { createDriverInspectionSchema, answerComplete, type InspectionAnswer, type InspectionItem } from '@/lib/driver-inspection';
import { prepareChecklistPhoto } from '@/lib/checklist-photo';
import { mileageConcern } from '@/lib/mileage-validation';
import './driver-checklist.css';

type Vehicle = {plate:string;model:string;code:string|null;mileage:number|null;status:string;operationalStatus?:string};
export function DriverChecklist({ token,vehicle,inspectionItems,configVersion }:{token:string;vehicle:Vehicle;inspectionItems:InspectionItem[];configVersion:string}) {
  const [operationalStatus,setOperationalStatus]=useState(vehicle.operationalStatus??'CLEAR');
  const [stage,setStage] = useState<'start'|'items'|'review'|'success'>('start');
  const [identification,setIdentification] = useState(''); const [mileage,setMileage] = useState('');
  const [answers,setAnswers] = useState<Record<string,InspectionAnswer>>({});
  const [index,setIndex] = useState(0); const [editing,setEditing] = useState(false);
  const [error,setError] = useState(''); const [photoBusy,setPhotoBusy] = useState(false); const [busy,setBusy] = useState(false);
  const [locked,setLocked] = useState(false); const [receipt,setReceipt] = useState('');
  const [configChanged,setConfigChanged]=useState(false);const [mileageWarning,setMileageWarning]=useState(false);
  const [previousMileage,setPreviousMileage]=useState(vehicle.mileage);
  const [mileageConfirmed,setMileageConfirmed]=useState(false);
  const [submittedAt,setSubmittedAt]=useState('');
  const concern=mileage.trim()!=='' ? mileageConcern(Number(mileage),previousMileage) : null;
  const key = useRef(''); const sending = useRef(false); const titleRef = useRef<HTMLHeadingElement>(null);
  const item = inspectionItems[index]; const answer = answers[item.id];
  const done = inspectionItems.filter(i=>answerComplete(i,answers[i.id])).length;
  const notApplicable=inspectionItems.filter(i=>answers[i.id]?.answer==='NOT_APPLICABLE').length;
  const problems = inspectionItems.filter(i=>answers[i.id]?.answer === 'ISSUE');
  useEffect(()=>{ if (stage !== 'start') { titleRef.current?.focus(); window.scrollTo({top:0,behavior:'instant'}); } },[stage,index]);
  useEffect(()=>{
    if (stage === 'start' || stage === 'success') return;
    const warn = (e:BeforeUnloadEvent)=>{e.preventDefault();}; window.addEventListener('beforeunload',warn);
    return ()=>window.removeEventListener('beforeunload',warn);
  },[stage]);
  function advance() { setError(''); if (editing || index === inspectionItems.length-1) {setEditing(false);setStage('review');} else setIndex(index+1); }
  function choose(value:'OK'|'ISSUE'|'NOT_APPLICABLE') {
    setError('');
    setAnswers(a=>({...a,[item.id]: value !== 'ISSUE' ? {item:item.id,answer:value,notes:''} : (a[item.id]?.answer === 'ISSUE' ? a[item.id] : {item:item.id,answer:'ISSUE',notes:''})}));
    if (value !== 'ISSUE') advance();
  }
  function update(patch:Partial<InspectionAnswer>) {setAnswers(a=>({...a,[item.id]:{...a[item.id],...patch}}));setError('');}
  async function photo(file?:File) {
    if (!file) return; setPhotoBusy(true); setError('');
    try {update({photo:await prepareChecklistPhoto(file)});} catch(e) {setError(e instanceof Error ? e.message : 'Não foi possível carregar a foto.');} finally {setPhotoBusy(false);}
  }
  function start(e:React.FormEvent) {
    e.preventDefault();
    if (!identification.trim() || !mileage.trim() || !Number.isInteger(Number(mileage)) || Number(mileage)<0 || Number(mileage)>9_999_999) {setError('Informe sua identificação e uma quilometragem válida.');return;}
    if(concern && !mileageConfirmed){setError('Confira o hodômetro e marque a confirmação da quilometragem.');return;}
    setError(''); setStage(editing ? 'review' : 'items'); setEditing(false);
  }
  async function submit() {
    if (sending.current) return;
    key.current ||= crypto.randomUUID();
    if(!mileage.trim() || (concern && !mileageConfirmed)){setError('Confira e confirme a quilometragem antes de enviar.');return;}
    const payload = createDriverInspectionSchema(inspectionItems).safeParse({driverIdentification:identification,mileage:Number(mileage),mileageConfirmedAgainst:mileageConfirmed ? previousMileage : undefined,submissionKey:key.current,configVersion,answers:inspectionItems.map(i=>answers[i.id])});
    if (!payload.success) {setError('Confira a identificação, a quilometragem e todos os itens. Preencha os tipos de problema e as fotos exigidas.');return;}
    sending.current=true; setBusy(true);setLocked(true);setError('');
    try {
      const response = await fetch(`/api/checklist/${encodeURIComponent(token)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload.data)});
      const body = await response.json();
      if(!response.ok && body.code==='MILEAGE_CONFIRMATION'){
        setPreviousMileage(body.previousMileage);setMileageConfirmed(false);setLocked(false);setEditing(true);setStage('start');
        throw new Error('O último KM registrado mudou. Confira o hodômetro novamente; suas respostas foram mantidas.');
      }
      if (!response.ok) {if(body.code==='CONFIG_CHANGED')setConfigChanged(true);if (response.status>=400 && response.status<500 && response.status!==409) setLocked(false);throw new Error(body.error ?? 'Não foi possível enviar. Tente novamente.');}
      setOperationalStatus(body.operationalStatus??operationalStatus); setMileageWarning(body.mileageWarning===true); setReceipt(body.id);setSubmittedAt(body.submittedAt); setStage('success');
    } catch(e) {setError(e instanceof TypeError ? 'Não foi possível conectar. Verifique a internet e tente enviar novamente.' : e instanceof Error ? e.message : 'Não foi possível confirmar o envio. Tente novamente.');}
    finally {sending.current=false;setBusy(false);}
  }
  const errorBox = error && <div className="dc-error" role="alert">{error}{configChanged && <button type="button" className="dc-primary mt-3" onClick={()=>window.location.reload()}>Recarregar checklist</button>}</div>;
  if (stage === 'success') return <main className="dc-page"><section className="dc-card dc-success"><RestrictionBanner status={operationalStatus} driver/><CheckCircle2 size={64}/><h1 tabIndex={-1} ref={titleRef}>Checklist enviado!</h1><p>A Frota recebeu a inspeção de <strong>{vehicle.plate}</strong>.</p><div className="dc-result">{inspectionItems.length-problems.length-notApplicable} itens OK · {problems.length} com problema{notApplicable>0 && ` · ${notApplicable} não se aplica`}</div>{problems.length>0 && <p className="dc-warning">Problemas registrados. Confirme a liberação com a equipe de Frota antes de sair.</p>}{mileageWarning&&<p className="dc-warning">Leitura de KM inferior ao cadastro. A Frota recebeu um alerta para conferir; o KM do veículo foi mantido.</p>}<small>Protocolo: {receipt}</small>{submittedAt && <p>Registrado em <time dateTime={submittedAt}>{new Date(submittedAt).toLocaleString('pt-BR')}</time></p>}<p>Você pode fechar esta página.</p></section></main>;
  return <main className="dc-page">
    <header className="dc-header"><span className="dc-logo"><Truck size={23}/></span><div><strong>Checklist do motorista</strong><small>Central de Controle de Frota</small></div></header>
    <section className="dc-vehicle" aria-label="Veículo identificado"><div><strong>{vehicle.plate}</strong>{vehicle.code && <span>Prefixo {vehicle.code}</span>}</div><p>{vehicle.model}</p></section>
    <RestrictionBanner status={operationalStatus} driver/>{stage === 'start' ? <form onSubmit={start}>
      <section className="dc-card"><span className="dc-eyebrow">ANTES DE COMEÇAR</span><h1 ref={titleRef} tabIndex={-1}>Vamos conferir o veículo?</h1><p className="dc-muted">Identifique-se e informe o hodômetro.</p>
        <label className="dc-label" htmlFor="driverIdentification">Matrícula ou identificação</label><input id="driverIdentification" className="dc-input" value={identification} onChange={e=>setIdentification(e.target.value)} placeholder="Digite sua matrícula ou identificação" autoComplete="username" autoCapitalize="none" maxLength={100} required/>
        <label className="dc-label" htmlFor="mileage">Quilometragem atual</label><div className="dc-km"><input id="mileage" className="dc-input" value={mileage} onChange={e=>{setMileage(e.target.value);setMileageConfirmed(false);setError('');}} placeholder="Informe o hodômetro atual" type="number" inputMode="numeric" min={0} max={9999999} step={1} required/><span>km</span></div>{previousMileage !== null && <p className="dc-hint">Último registro: {previousMileage.toLocaleString('pt-BR')} km</p>}
        {concern && <div className="dc-warning" role="status"><p>{concern==='LOWER' ? 'KM menor que o último registro. Confira o hodômetro. A leitura será registrada para conferência sem reduzir o KM do veículo.' : `Aumento de ${(Number(mileage)-previousMileage!).toLocaleString('pt-BR')} km desde o último registro. Confira se digitou algum número a mais.`}</p><label className="dc-confirm"><input type="checkbox" checked={mileageConfirmed} onChange={e=>setMileageConfirmed(e.target.checked)}/>Conferi o hodômetro e confirmo este KM</label></div>}{['UNKNOWN','STOPPED','MAINTENANCE'].includes(vehicle.status) && <p className="dc-warning">O checklist não autoriza a saída. Confirme a disponibilidade com a Frota.</p>}
      </section>{errorBox}<div className="dc-bottom"><button className="dc-primary" type="submit">{editing ? 'Voltar ao resumo' : 'Iniciar checklist'}<ArrowRight size={21}/></button><small>{inspectionItems.length} itens · toque em OK para avançar</small></div>
    </form> : stage === 'items' ? <>
      <div className="dc-progress"><div><span>Item {index+1} de {inspectionItems.length}</span><strong>{done} de {inspectionItems.length} itens concluídos</strong></div><progress value={done} max={inspectionItems.length} aria-label="Itens concluídos"/></div>
      <section className="dc-card dc-question" aria-labelledby="item-title"><span className="dc-eyebrow">{item.group}</span><h1 id="item-title" ref={titleRef} tabIndex={-1}>{item.label}</h1><p className="dc-muted">{item.help}</p>
        <div className="dc-answers" role="group" aria-label={`Condição: ${item.label}`}><button type="button" className="dc-ok" aria-pressed={answer?.answer === 'OK'} onClick={()=>choose('OK')} disabled={photoBusy}><Check size={28}/>OK</button><button type="button" className="dc-problem" aria-pressed={answer?.answer === 'ISSUE'} onClick={()=>choose('ISSUE')} disabled={photoBusy}><X size={28}/>PROBLEMA</button></div>
        {item.allowsNotApplicable && <button type="button" className="dc-back" disabled={photoBusy} onClick={()=>choose('NOT_APPLICABLE')}>Não se aplica a este veículo</button>}{answer?.answer === 'ISSUE' && <div className="dc-problem-fields"><fieldset><legend>Qual problema? <small>Obrigatório</small></legend><div className="dc-options">{item.problems.map(problem=><button type="button" key={problem} aria-pressed={answer.problemType === problem} onClick={()=>update({problemType:problem})}>{problem}</button>)}</div></fieldset>
          <label className="dc-camera"><Camera size={22}/>{photoBusy ? 'Preparando foto…' : answer.photo ? 'Trocar foto' : 'Tirar foto'}<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={photoBusy} onChange={e=>{void photo(e.target.files?.[0]);e.target.value='';}}/></label><p className="dc-hint">Foto {item.requiresPhoto ? 'obrigatória' : 'opcional'} do problema. JPG, PNG ou WebP.</p>
          {answer.photo && <div className="dc-photo"><Image src={answer.photo} unoptimized width={280} height={180} alt={`Foto do problema: ${item.label}`}/><button type="button" onClick={()=>update({photo:undefined})} aria-label="Remover foto">Remover foto</button></div>}
          <label className="dc-label" htmlFor="observation">Observação <small>Opcional</small></label><textarea id="observation" className="dc-input" rows={2} maxLength={2000} value={answer.notes} onChange={e=>update({notes:e.target.value})} placeholder="Algo mais que a Frota precisa saber?"/>
        </div>}
      </section>{errorBox}<div className="dc-bottom">{answer?.answer === 'ISSUE' && <button type="button" className="dc-primary" disabled={!answerComplete(item,answer) || photoBusy} onClick={advance}>{editing || index===inspectionItems.length-1 ? 'Conferir resumo' : 'Próximo item'}<ArrowRight size={21}/></button>}<button type="button" className="dc-back" disabled={photoBusy} onClick={()=>{setError('');if (editing) {setEditing(false);setStage('review');} else if(index>0) setIndex(index-1); else setStage('start');}}><ArrowLeft size={18}/>{editing ? 'Voltar ao resumo' : 'Voltar'}</button></div>
    </> : <>
      <section className="dc-card"><span className="dc-eyebrow">ÚLTIMA CONFERÊNCIA</span><h1 ref={titleRef} tabIndex={-1}>Resumo do checklist</h1><p className="dc-muted">Confira os dados. Ao tocar em Enviar checklist, você confirma esta inspeção.</p><dl className="dc-summary-info"><div><dt>Identificação</dt><dd>{identification}</dd></div><div><dt>Quilometragem</dt><dd>{Number(mileage).toLocaleString('pt-BR')} km</dd></div></dl>{!locked && <button className="dc-edit" type="button" onClick={()=>{setEditing(true);setStage('start');}}><Pencil size={16}/>Editar identificação / km</button>}<div className="dc-result">{inspectionItems.length-problems.length-notApplicable} OK · {problems.length} com problema{notApplicable>0 && ` · ${notApplicable} não se aplica`}</div>
        <ul className="dc-summary-list">{inspectionItems.map((definition,i)=>{const a=answers[definition.id];return <li key={definition.id}><div>{a?.answer==='OK' ? <Check className="dc-green" size={20}/> : a?.answer==='NOT_APPLICABLE' ? <span className="text-slate-400" aria-hidden="true">—</span> : <X className="dc-red" size={20}/>}<div><strong>{definition.group} · {definition.label}</strong><p>{a?.answer==='OK' ? 'OK' : a?.answer==='NOT_APPLICABLE' ? 'Não se aplica' : a?.problemType ?? 'Resposta incompleta'}</p>{a?.notes && <p>{a.notes}</p>}{a?.photo && <Image src={a.photo} unoptimized width={80} height={60} alt={`Foto: ${definition.label}`}/>}</div></div>{!locked && <button type="button" className="dc-edit" aria-label={`Editar ${definition.label}`} onClick={()=>{setIndex(i);setEditing(true);setStage('items');}}><Pencil size={18}/></button>}</li>;})}</ul>
      </section>{errorBox}<div className="dc-bottom"><button className="dc-primary" type="button" disabled={busy || configChanged || done!==inspectionItems.length} onClick={()=>void submit()}><Send size={21}/>{busy ? 'Enviando…' : locked ? 'Tentar enviar novamente' : 'Enviar checklist'}</button><small>{locked ? 'Se a conexão falhar, tente novamente. O envio não será duplicado.' : 'Data e hora serão registradas automaticamente. Você pode corrigir qualquer item antes de enviar.'}</small></div>
    </>}
  </main>;
}
