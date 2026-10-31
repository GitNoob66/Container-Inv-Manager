import { describe,it,expect } from 'vitest';
import { blankConfig,makePlan,groupPlan,parsePendencyRows,normalizedDate,type PendingContainer } from '../lib/backload';
import { parseWagonText,wagonConfig,orderWagons } from '../lib/wagon-details';
const c=(number:string,size:20|40=20,date='2026-10-07',smtp='100'):PendingContainer=>({id:number,number,size,smtp,smtpDate:date,terminal:'CT3',line:'CMA',gross:12,dwell:3,source:'FOIS'});
describe('Backloading requirements',()=>{
 it('single 45 wagons is 90 TEUs; double is 180',()=>{expect(makePlan([],blankConfig()).capacity).toBe(90);expect(makePlan([],{...blankConfig(),stack:'Double'}).capacity).toBe(180);});
 it('excludes blank SMTP and FOIS dates',()=>{expect(makePlan([c('a',20,'','100'),c('b',20,'2026-10-07','')],blankConfig()).selected).toHaveLength(0);});
 it('uses oldest date then smallest numeric SMTP across terminals',()=>{const pool=[c('a',40,'2026-10-08','1'),{...c('b',40,'2026-10-07','10'),terminal:'MICT',source:'MICT' as const},c('c',40,'2026-10-07','2')];expect(makePlan(pool,blankConfig()).selected.map(c=>c.number)).toEqual(['c','b','a']);});
 it('keeps undated MICT SMTP references eligible',()=>{expect(makePlan([{...c('a',40,'','200'),source:'MICT',terminal:'MICT'}],blankConfig()).used).toBe(2);});
 it('splits SMTP at capacity and leaves remainder',()=>{const plan=makePlan([c('a',40),c('b',40),c('c',40)],{...blankConfig(),wagons:2});expect(plan.used).toBe(4);expect(plan.remaining).toHaveLength(1);});
 it('enforces even 20ft and TEUs',()=>{const plan=makePlan([c('a'),c('b'),c('c')],blankConfig());expect(plan.selected).toHaveLength(2);expect(plan.used).toBe(2);});
 it('uses highest SMTP dwell including unselected containers',()=>{expect(groupPlan([c('a')],[c('a'),{...c('b'),dwell:19}])[0]?.dwell).toBe(19);});
 it('maps MICT Agent Reference No and fixes terminal',()=>{const rows=parsePendencyRows([{'Container No':'ABCD1234567','Container Size':'40 FT','Agent Reference No':'223','Box Operator':'MSC','Gross Weight/VGM':'28000','Dwell days':'8'}],'MICT');expect(rows[0]).toMatchObject({terminal:'MICT',smtp:'223',size:40,gross:28,dwell:8});});
 it('normalizes SMTP date',()=>{expect(normalizedDate('07-10-2026')).toBe('2026-10-07');expect(normalizedDate('31-02-2026')).toBe('');});
 it('excludes BVCM and BVZC from wagon count',()=>{expect(wagonConfig([{sn:1,number:'37402510417',type:'BLSSA'},{sn:2,number:'87122010612',type:'BVCM'},{sn:3,number:'87122010613',type:'BVZC'}]).wagons).toBe(1);});
 it('extracts wagon numbers and normalizes CWC L-004',()=>{expect(parseWagonText('CWC L-004\n1 37402510417 BLSSA\n2 87122010612 BVCM')).toEqual({rakeName:'CWC L-04',rows:[{sn:1,number:'37402510417',type:'BLSSA'},{sn:2,number:'87122010612',type:'BVCM'}]});});
});
it('reads E-RR 8+3 wrapped wagon numbers',()=>{expect(parseWagonText('1 CWC BLSSB 38262610 73 17.6 0\n880\n2 CWC BLSSA 37262610 71 18.55\n050').rows.map(r=>r.number)).toEqual(['38262610880','37262610050']);});
it('moves brake vans last and continuously reindexes',()=>{expect(orderWagons([{sn:5,number:'87122010612',type:'BVCM'},{sn:9,number:'38262610880',type:'BLSSB'},{sn:2,number:'87122010613',type:'BVZC'}]).map(r=>[r.sn,r.type])).toEqual([[1,'BLSSB'],[2,'BVCM'],[3,'BVZC']]);});
it('allows odd 40ft count and maximizes TEUs instead of dropping a late 20ft',()=>{const p=makePlan([c('a',20),c('b',40),c('c',40),c('d',40)],{...blankConfig(),wagons:3});expect(p.used).toBe(6);expect(p.selected.map(r=>r.number)).toEqual(['b','c','d']);});
it('chooses earliest feasible FIFO subset with even 20ft total',()=>{const p=makePlan([c('a',20),c('b',40),c('c',20),c('d',40)],{...blankConfig(),wagons:2});expect(p.used).toBe(4);expect(p.selected.map(r=>r.number)).toEqual(['a','b','c']);});

it('reads wrapped wagon suffix alongside wrapped CC',()=>{expect(parseWagonText('44 CWC BLSSA 37262610 71. 18.55\n050 7').rows[0]?.number).toBe('37262610050');});
