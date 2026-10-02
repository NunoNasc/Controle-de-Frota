import { chromium, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const db = new PrismaClient();
const browser = await chromium.launch({channel:'msedge',headless:true});
const page = await browser.newPage({viewport:{width:1920,height:1080}});
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
const base='http://127.0.0.1:3000';
try {
 await mkdir('test-results',{recursive:true});
 await page.goto(base);
 await expect(page.locator('[data-metric=frota] strong')).toHaveText('24');
 await expect(page.getByText('24 veículos estão com a situação operacional não informada.',{exact:false})).toBeVisible();
 for (const key of ['disponiveis','manutencao','parados','criticos','pendentes','vencidas','ocorrencias']) await expect(page.locator(`[data-metric=${key}] strong`)).toHaveText('00');
 await page.screenshot({path:'test-results/real-dashboard-desktop.png',fullPage:true});
 for (const key of ['frota','disponiveis','manutencao','parados','criticos','pendentes','vencidas','ocorrencias']) {
  await page.goto(base); await page.locator(`[data-metric=${key}]`).click(); await page.waitForURL(`**/painel/${key}`); await expect(page.getByRole('heading',{level:1})).toBeVisible();
 }
 await page.goto(`${base}/frota`);
 await expect(page.getByText('24 registros · Página 1 de 3')).toBeVisible();
 await expect(page.getByRole('button',{name:'Cubagem',exact:true})).toBeVisible();
 await page.getByRole('textbox',{name:'Buscar em Frota'}).fill('QTP8821');
 await expect(page.locator('tbody')).toContainText('22 m³');
 await page.getByRole('link',{name:'Detalhes de QTP8821'}).click();
 await expect(page.getByRole('heading',{name:'QTP8821',exact:true})).toBeVisible();
 await expect(page.getByText('22 m³',{exact:true})).toBeVisible();
 const vehicle = await db.vehicle.findUniqueOrThrow({where:{plate:'QTP8821'}});
 await page.goto(`${base}/checklist/${vehicle.qrToken}`);
 await expect(page.getByPlaceholder('Informe o hodômetro atual')).toBeVisible();
 await expect(page.getByText('Confirme a disponibilidade com a Frota.',{exact:false})).toBeVisible();
 for (const width of [1920,1024,390]) {
  await page.setViewportSize({width,height:900});
  for (const path of ['/','/frota',`/frota/${vehicle.id}`,`/checklist/${vehicle.qrToken}`]) {
   await page.goto(base+path); await page.getByRole('heading',{level:1}).waitFor();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),`Overflow ${width} ${path}`);
  }
 }
 await page.goto(base); await page.screenshot({path:'test-results/real-dashboard-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('PASS: cards, navegação, frota real, cubagem, QR, hodômetro ausente e responsividade 1920/1024/390.');
} finally {await browser.close();await db.$disconnect();}
