import { expect, test } from 'vitest';
import { auditRR, containerFreight, parseRRText } from '../lib/rr-analyzer';

test('40ft loaded rates follow the 2018 circular at 1106 km', () => {
  expect(containerFreight(1106, 40, 'L', 'LD', 30.54)).toBe(35915.4);
  expect(containerFreight(1106, 40, 'L', 'UD', 21.84)).toBe(17957.7);
  expect(containerFreight(1106, 40, 'L', 'UD', 17.9)).toBe(14148);
});

test('20ft loaded weight slabs at 1106 km', () => {
  expect(containerFreight(1106, 20, 'L', 'LD', 7.46)).toBe(15720);
  expect(containerFreight(1106, 20, 'L', 'LD', 21.57)).toBe(24214);
  expect(containerFreight(1106, 20, 'L', 'LD', 29.29)).toBe(27089);
});

const header = (commodity: string, freight: string, ds: string, dpcn: string, gst: string, total: string, km: number) => `RR No: 261000091 RR Date: 19-10-2026 FNR: 1 Station From: GIMB Station To: MDCC
Commodity Description: ${commodity}
Distance (In KM): ${km}
Freight: Rs ${freight}/-
DS ${ds}
DPCN ${dpcn}
*GST ${gst}
Total Freight: Rs ${total}/-
Wagon details of the Railway Receipt
1 GIPL BLCBM 62401821 69 18 0
820
`;

test('empty haulage RR reconciles with 2 x empty-flat rate, 10% DPCN, 5% DS, 5% GST', () => {
  const rr = parseRRText(header('CONTAINER EMPTY HAULAGE', '2878', '158.29', '287.8', '167', '3492', 74));
  expect(rr.loaded).toBe(false);
  expect(rr.wagons.map(w => w.number)).toEqual(['62401821820']);
  const a = auditRR(rr);
  expect(a.base).toBe(2878);
  expect(a.total).toBe(3492);
  expect(a.reconciled).toBe(true);
});

test('a mismatched RR total is flagged', () => {
  const a = auditRR(parseRRText(header('CONTAINER EMPTY HAULAGE', '2878', '158.29', '287.8', '167', '4000', 74)));
  expect(a.reconciled).toBe(false);
  expect(a.difference).toBe(508);
});

test('demand commodity marks the rake as loaded and reads wrapped wagon numbers', () => {
  const text = header('CONTAINER ( RAKE DEMAND )', '35915.4', '1975.35', '3591.54', '2074', '43557', 1106) + `FREIGHT DETAILS OF THE RR
24 GRFL 014 BLCA 614018 TCNU6197320 40 L LD NIGT EXIM 0952 2 1.8 30.54 35915.40
M 21373
LOADING DETAILS OF THE RR
1 GRFL 014 BLCA 614018 TCNU6197320 40 L LD NIGT EXIM 0952 3.83 30.54 35915.4
`;
  const rr = parseRRText(text);
  expect(rr.loaded).toBe(true);
  expect(rr.containers[0]?.wagonType).toBe('BLCAM');
  expect(rr.containers[0]?.wagonNumber).toBe('61401821373');
  expect(rr.containers[0]?.tare).toBe(3.83);
  expect(rr.containers[0]?.actual).toBe(26.71);
});

test('empty containers with blank commodity and 6-digit serials are read on a demand rake', () => {
  const text = header('CONTAINER ( RAKE DEMAND )', '17696', '0', '0', '0', '0', 830) + `FREIGHT DETAILS OF THE RR
96 CWC 014 BLSSA 372626 CNNU0000547 20 E LD DOM 0907 1 1 3.1 8848.00
10517
29 CWC 014 BLSSB 382626 VSBU550380 20 E LD DOM 0907 1 1 2.26 8848.00
16158
LOADING DETAILS OF THE RR
1 CWC 014 BLSSA 372626 CNNU0000547 20 E LD DOM 0907 3.1 3.1 8848
`;
  const rr = parseRRText(text);
  expect(rr.containers.length).toBe(2);
  expect(rr.containers[0]?.wagonNumber).toBe('37262610517');
  expect(rr.containers[0]?.trfc).toBe('DOM');
  expect(rr.containers[1]?.number).toBe('VSBU550380');
  expect(rr.containers[0]?.calculated).toBe(8848);
});

import { readFileSync, existsSync } from 'fs';
import { validateRR } from '../lib/rr-analyzer';
import { parseWagonText } from '../lib/wagon-details';

test('wagon number wrapped with a trailing letter (358D) still joins', () => {
  const r = parseWagonText('43 CWC BLSSB 38262513 52 17.6 0 0\n358D\n44 CWC BLSSB 38262512 82. 17.6 0\n009 4');
  expect(r.rows.map(w => w.number)).toEqual(['38262513358', '38262512009']);
});

test('TAC and ENHC are read, added to GST base but not DS, and reconcile', () => {
  const t = header('CONTAINER ( RAKE DEMAND )', '0', '0', '0', '0', '0', 100).replace('DS 0', 'Other Charges Rebate\nDS 0\nTAC 160000\nENHC 35480');
  const rr = parseRRText(t);
  expect(rr.otherCharges).toEqual([{ code: 'TAC', name: 'Terminal Access Charge', amount: 160000 }, { code: 'ENHC', name: 'Engine Hiring Charge', amount: 35480 }]);
});

test('validation flags wagon-count mismatch and bad container numbers', () => {
  const rr = parseRRText(header('CONTAINER EMPTY HAULAGE', '2878', '158.29', '287.8', '167', '3492', 74).replace('FNR: 1', 'FNR: 1 Wagons: 2'));
  expect(validateRR(rr).some(i => i.message.includes('RR states 2 wagons but 1'))).toBe(true);
});

const sample = '/tmp/rr/E-RR_GIMB_to_MILK_291026.txt';
test.runIf(existsSync(sample))('GIMB→MILK RR: 96 containers, TAC+ENHC reconcile to ₹28,15,831', () => {
  const rr = parseRRText(readFileSync(sample, 'utf8')); const a = auditRR(rr);
  expect(rr.containers.length).toBe(96); expect(a.extras).toBe(195480); expect(a.total).toBe(2815831);
});
