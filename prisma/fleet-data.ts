/** Relação enviada em 28/09/2026. QTO6109 aparece duas vezes na imagem.
 * Placas normalizadas sem hífen. Valores ausentes permanecem nulos.
 */
const rows: [string,string,number,string,number|null][] = [
  ['QTP8821','VW/6.160 DRC 4X2',2020,'3/4',22],
  ['PRI0488','VW/8.160 E DELIVERY - CARGA 3/4',2018,'3/4',22],
  ['OMN6012','FORD/CARGO 816 S',2014,'3/4',32],
  ['PRH9808','VW/8.160',2018,'3/4',32],
  ['PRI1868','VW/8.160',2018,'3/4',32],
  ['OML2332','FORD/CARGO 816',2015,'3/4',32],
  ['OMM0782','FORD/CARGO 1119',2015,'3/4',42],
  ...['QTO5919','QTO5939','QTO5969','QTO6079','QTO6109','QTO6099','QTO6129','QTO6309','QTO6049','QTO6329','QTO6349'].map(plate => [plate,'VW/11.180 DRC 4X2',2020,'3/4',42] as [string,string,number,string,number]),
  ['PRI4107','FORD/CARGO 1119',2018,'3/4',42],
  ['PRI3158','FORD/CARGO 1119',2018,'3/4',42],
  ['PRG4591','VW/24.280 CRM 6X2',2018,'TRUCK',85],
  ['OFL9715','VW/13.190 E CONSTELLATION - TOCO',2012,'TOCO',85],
  ['OMK8322','FORD/CARGO 2429 E - CARGA TRUCK',2015,'TRUCK',85],
  ['QTO6479','VW/19.360 CTC 4X2',2020,'CAVALO',null],
];
export const fleet = rows.map(([plate,model,year,profile,cargoVolumeM3]) => ({plate,model,year,profile,cargoVolumeM3,brand:model.startsWith('VW/') ? 'Volkswagen' : 'Ford',category:profile === 'CAVALO' ? 'Cavalo mecânico' : 'Caminhão'}));
if (new Set(fleet.map(v=>v.plate)).size !== fleet.length) throw new Error('Placa duplicada na importação.');
