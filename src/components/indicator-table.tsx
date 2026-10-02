'use client';
import {useState} from 'react';
import Link from 'next/link';
import {Button} from './ui/button';
export type IndicatorRow={key:string;cells:string[];href?:string};
export function IndicatorTable({headers,rows,label}:{headers:string[];rows:IndicatorRow[];label:string}){
 const [page,setPage]=useState(0);const pages=Math.max(1,Math.ceil(rows.length/10)),current=Math.min(page,pages-1);
 if(!rows.length)return <p className="p-6 text-sm text-slate-500">Nenhum registro para os filtros selecionados.</p>;
 return <><div className="overflow-x-auto" tabIndex={0} aria-label={label}><table className="op-table" style={{minWidth:headers.length>4?850:420}}><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.slice(current*10,current*10+10).map(r=><tr key={r.key}>{r.cells.map((cell,index)=><td key={index}>{index===0&&r.href?<Link className="plate" href={r.href}>{cell}</Link>:cell}</td>)}</tr>)}</tbody></table></div><div className="flex flex-wrap items-center justify-between gap-2 p-4 text-xs text-slate-500"><span>{rows.length} registros · página {current+1} de {pages}</span><div className="flex gap-2"><Button variant="outline" disabled={current===0} onClick={()=>setPage(current-1)}>Anterior</Button><Button variant="outline" disabled={current+1===pages} onClick={()=>setPage(current+1)}>Próxima</Button></div></div></>;
}
