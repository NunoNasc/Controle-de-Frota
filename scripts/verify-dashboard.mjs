import { chromium, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const db = new PrismaClient();
const browser = await chromium.launch({ channel:'msedge',headless:true });
const page = await browser.newPage({ viewport:{ width:1920,height:1080 } });
const errors=[]; page.on('pageerror',e => errors.push(e.message));
const base='http://127.0.0.1:3000';
try {
  await mkdir('test-results',{ recursive:true });
  await page.goto(base); await page.getByRole('heading',{ name:'Dashboard Operacional',exact:true }).waitFor();
  const sections=['REQUER AÇÃO','STATUS DA FROTA','MANUTENÇÕES EM ANDAMENTO','PREVENTIVAS PRÓXIMAS DO VENCIMENTO','CHECKLISTS COM NÃO CONFORMIDADE'];
  for (const name of sections) await page.getByRole('heading',{ name,exact:true }).waitFor();
  assert.equal(await page.locator('[data-metric]').count(),8);
  assert.equal(Number(await page.locator('[data-metric=frota] strong').innerText()),await db.vehicle.count());
  assert.equal(Number(await page.locator('[data-metric=disponiveis] strong').innerText()),await db.vehicle.count({ where:{ active:true,status:'AVAILABLE',availability:'AVAILABLE' } }));
  assert.equal(Number(await page.locator('[data-metric=criticos] strong').innerText()),await db.alert.count({ where:{ priority:'CRITICAL',status:{ in:['OPEN','IN_PROGRESS'] } } }));
  await page.screenshot({ path:'test-results/operational-1920.png',fullPage:true });
  assert.equal(await page.locator('.op-action-panel .op-table-scroll').evaluate(el => el.scrollWidth <= el.clientWidth),true,'all action columns fit an office monitor');
  const headers=await page.locator('.op-action-panel th').allTextContents();
  assert.deepEqual(headers,['Prioridade','Placa','Veículo','Problema','Origem','Detectado em','Tempo em aberto','Responsável','Status','Ação']);
  let priorities=[];
  do { priorities.push(...await page.locator('.op-action-panel tbody tr').evaluateAll(rows => rows.map(r => r.dataset.priority))); const next=page.locator('.op-action-panel').getByRole('button',{ name:'Próximas pendências' }); if (await next.isDisabled()) break; await next.click(); } while(true);
  const rank={ CRITICAL:0,HIGH:1,MEDIUM:2,LOW:3 }; assert.deepEqual(priorities.map(p => rank[p]),priorities.map(p => rank[p]).sort((a,b)=>a-b));
  for (const key of ['frota','disponiveis','manutencao','parados','criticos','pendentes','vencidas','ocorrencias']) {
    await page.goto(base); const link=page.locator(`[data-metric=${key}]`); const count=Number(await link.locator('strong').innerText()); await link.click(); await page.waitForURL(`**/painel/${key}`); await page.getByRole('heading',{ level:1 }).waitFor(); assert.ok((await page.locator('.page-heading p').innerText()).startsWith(`${count} registros`),key);
  }
  await page.goto(base); await page.getByLabel('Veículo',{ exact:true }).selectOption('FT-005'); await page.waitForURL('**/?vehicle=FT-005');
  await page.getByLabel('Status do veículo').selectOption('STOPPED'); await page.waitForURL('**status=STOPPED');
  await page.getByLabel('Criticidade',{ exact:true }).selectOption('CRITICAL'); await page.waitForURL('**priority=CRITICAL');
  await page.getByLabel('Período de detecção').selectOption('30'); await page.waitForURL('**period=30');
  assert.equal(Number(await page.locator('[data-metric=frota] strong').innerText()),1);
  const plates=await page.locator('.op-action-panel .plate').allTextContents(); assert.ok(plates.every(p=>p==='NOP5Q67'));
  await page.locator('[data-metric=ocorrencias]').click(); assert.equal(new URL(page.url()).searchParams.get('vehicle'),'FT-005'); assert.equal(new URL(page.url()).searchParams.get('priority'),'CRITICAL');
  const action=page.locator('.op-row-action').first(); if (await action.count()) { await action.click(); await page.waitForURL('**/ocorrencias?record=*'); await expect(page.locator('tbody tr')).toHaveCount(1); await page.getByRole('link',{ name:'Mostrar todos os registros' }).click(); await page.waitForURL(base+'/ocorrencias'); await expect(page.locator('tbody tr')).toHaveCount(Math.min(10,await db.incident.count())); }
  const center=await db.costCenter.findFirstOrThrow(); await page.goto(base); await page.getByLabel('Centro de custo',{ exact:true }).selectOption(center.id); await page.waitForURL('**costCenter=*');
  assert.equal(Number(await page.locator('[data-metric=frota] strong').innerText()),await db.vehicle.count({ where:{ costCenterId:center.id } }));
  await page.goto(`${base}/?vehicle=missing`); await page.getByText('Nenhuma situação exige intervenção com estes filtros.').waitFor(); assert.equal(Number(await page.locator('[data-metric=frota] strong').innerText()),0);
  await page.getByRole('button',{ name:'Limpar filtros' }).click(); await page.waitForURL(base+'/');
  for (const [width,height] of [[1440,1000],[820,1180],[390,844]]) { await page.setViewportSize({ width,height }); await page.goto(base); await page.getByRole('heading',{ name:'Dashboard Operacional',exact:true }).waitFor(); assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`page overflow ${width}`); await page.screenshot({ path:`test-results/operational-${width}.png`,fullPage:true }); }
  assert.deepEqual(errors,[]); console.log('PASS: oito cards reconciliados, drill-down, filtros combinados, prioridade global paginada, registros relacionados, vazio e layouts 1920/1440/820/390.');
} finally { await browser.close(); await db.$disconnect(); }
