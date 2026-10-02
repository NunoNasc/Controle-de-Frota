'use client';
import {useEffect,useTransition} from 'react';
import {useRouter} from 'next/navigation';
export function ModuleRefresh({interval=true}:{interval?:boolean}){const router=useRouter();const [pending,start]=useTransition();useEffect(()=>{if(!interval)return;const timer=setInterval(()=>{if(document.visibilityState==='visible')start(()=>router.refresh());},30000);return()=>clearInterval(timer);},[router,interval]);return <button type="button" className="subtle-link" disabled={pending} onClick={()=>start(()=>router.refresh())}>{pending?'Atualizando…':interval?'Atualizar · automático a cada 30 s':'Atualizar'}</button>;}
