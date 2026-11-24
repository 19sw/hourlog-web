// Builds practice/mysql-accounting/schema-and-data.sql for the course
// "会计人的 MySQL" (courses/mysql-for-accounting.js).
//
//   node tools/build-practice-data.mjs            # writes the file (and checks the invariants below)
//   node tools/build-practice-data.mjs --stdout   # prints it instead (the tests compare it with the file)
//
// The output is plain DDL + INSERTs with literal values: importing it never
// uses RAND(), NOW() or anything else that varies, so every import gives the
// same rows. Amounts vary through a seeded generator HERE, not in SQL.
//
// Fictional company 晴川文具贸易有限公司, Q1 2026, CNY, VAT 13% on goods.
// Opening balances (2025 year-end) are voucher 2025-12-000 dated 2025-12-31,
// so every 2026 filter leaves them out. Profit-and-loss
// accounts are not closed during the quarter (表结法).
//
// Planted issues the lessons ask the learner to find:
//   1. one unbalanced voucher (March office supplies: debit 1,350.00, credit 1,530.00);
//   2. one duplicate AP invoice (恒达笔业 04418827 entered and posted twice);
//   3. one unapplied customer receipt (青松物业 11,300.00 on 2026-03-27).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(WEB, 'practice', 'mysql-accounting', 'schema-and-data.sql');

// ------------------------------------------------------------ helpers
const cents = (x) => Math.round(x * 100);           // all money is handled in integer cents
const money = (c) => (c / 100).toFixed(2);
let seed = 20260101;
function rand() { // mulberry32
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const vary = (base, spread = 0.15) => Math.round(cents(base) * (1 - spread + 2 * spread * rand()) / 10) * 10; // to 0.10
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const q = (s) => (s === null || s === undefined ? 'NULL' : typeof s === 'number' ? String(s) : `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`);
function assert(cond, msg) { if (!cond) throw new Error('invariant failed: ' + msg); }

// ------------------------------------------------------------ master data
const departments = [
  ['D01', '管理部'], ['D02', '销售部'], ['D03', '仓储物流部'], ['D04', '财务部'],
];
const accounts = [
  ['1001', '库存现金', '资产', '借'],
  ['1002', '银行存款', '资产', '借'],
  ['1122', '应收账款', '资产', '借'],
  ['1221', '其他应收款', '资产', '借'],
  ['1405', '库存商品', '资产', '借'],
  ['1601', '固定资产', '资产', '借'],
  ['1602', '累计折旧', '资产', '贷'],
  ['2202', '应付账款', '负债', '贷'],
  ['2211', '应付职工薪酬', '负债', '贷'],
  ['2221', '应交税费', '负债', '贷'],
  ['4001', '实收资本', '所有者权益', '贷'],
  ['4104', '利润分配', '所有者权益', '贷'],
  ['6001', '主营业务收入', '损益', '贷'],
  ['6401', '主营业务成本', '损益', '借'],
  ['6601', '销售费用', '损益', '借'],
  ['6602', '管理费用', '损益', '借'],
  ['6603', '财务费用', '损益', '借'],
];
const customers = [
  ['C001', '北辰科技有限公司', '北京', 30, '010-6655 0101'],
  ['C002', '东湖教育培训中心', '武汉', 45, '027-8766 0202'],
  ['C003', '南山设计工作室', '深圳', 30, null],
  ['C004', '西岭连锁书店', '成都', 60, '028-8533 0404'],
  ['C005', '青松物业管理有限公司', '杭州', 30, '0571-8890 0505'],
  ['C006', '海棠酒店管理有限公司', '厦门', 45, null],
];
const creditDays = Object.fromEntries(customers.map((c) => [c[0], c[3]]));
const vendors = [
  ['S001', '明光纸业有限公司', 30],
  ['S002', '恒达笔业有限公司', 45],
  ['S003', '优印办公设备有限公司', 30],
  ['S004', '安居物业服务有限公司', 15],
  ['S005', '快运物流有限公司', 30],
];
const payDays = Object.fromEntries(vendors.map((v) => [v[0], v[2]]));

// ------------------------------------------------------------ vouchers
const vouchers = []; // { date, desc, created, lines: [{acct, dept, cust, vend, dr, cr}], order }
function voucher(date, desc, lines, { created = null, order = 5 } = {}) {
  const v = { date, desc, created: created || `${date} ${String(9 + (vouchers.length % 8)).padStart(2, '0')}:${String((vouchers.length * 7) % 60).padStart(2, '0')}:00`, lines, order };
  vouchers.push(v);
  return v;
}
const L = (acct, dr, cr, ext = {}) => ({ acct, dr: dr || 0, cr: cr || 0, dept: ext.dept || null, cust: ext.cust || null, vend: ext.vend || null });

// ------------------------------------------------------------ sub-ledgers
const arInvoices = []; // { no, cust, date, due, net, tax, total, v }
const arReceipts = []; // { no, cust, date, amount, v, apply: [[invoiceNo, amount]] }
const apInvoices = []; // { no, vend, date, due, net, tax, total, v }
const apPayments = []; // { no, vend, date, amount, v, apply: [[apIndex, amount]] }

// Opening balances (at 2025-12-31). Opening invoices are fully open at that date.
const openingAR = [
  ['XS-2511-021', 'C004', '2025-11-20', 80000],
  ['XS-2512-007', 'C001', '2025-12-08', 60000],
  ['XS-2512-015', 'C002', '2025-12-18', 40000],
  ['XS-2512-022', 'C006', '2025-12-26', 30000],
];
const openingAP = [ // [vendor invoice no, vendor, date, net, vatRate]
  ['03317265', 'S001', '2025-12-10', 100000, 0.13],
  ['04410931', 'S002', '2025-12-20', 50000, 0.13],
  ['00872210', 'S004', '2025-12-25', 12000, 0],
];
const opening = { cash: 3200, bank: 486500, inventory: 168000, fixed: 120000, accDep: 36000, payroll: 44000, vat: 15600, capital: 500000 };
{
  const lines = [L('1001', cents(opening.cash)), L('1002', cents(opening.bank))];
  for (const [no, cust, date, net] of openingAR) {
    const tax = cents(net * 0.13), total = cents(net) + tax;
    arInvoices.push({ no, cust, date, due: addDays(date, creditDays[cust]), net: cents(net), tax, total, v: null });
    lines.push(L('1122', total, 0, { cust }));
  }
  lines.push(L('1405', cents(opening.inventory)), L('1601', cents(opening.fixed)), L('1602', 0, cents(opening.accDep)));
  for (const [no, vend, date, net, rate] of openingAP) {
    const tax = cents(net * rate), total = cents(net) + tax;
    apInvoices.push({ no, vend, date, due: addDays(date, payDays[vend]), net: cents(net), tax, total, v: null });
    lines.push(L('2202', 0, total, { vend }));
  }
  lines.push(L('2211', 0, cents(opening.payroll)), L('2221', 0, cents(opening.vat)), L('4001', 0, cents(opening.capital)));
  const dr = lines.reduce((s, l) => s + l.dr, 0), cr = lines.reduce((s, l) => s + l.cr, 0);
  lines.push(L('4104', 0, dr - cr)); // retained earnings is the balancing figure
  const v = voucher('2025-12-31', '期初余额', lines, { created: '2025-12-31 18:00:00', order: 0 });
  for (const inv of arInvoices) inv.v = v;
  for (const inv of apInvoices) inv.v = v;
}

// Sales: [invoice no, customer, date, net]
const sales = [
  ['XS-2601-001', 'C001', '2026-01-05', 56000],
  ['XS-2601-002', 'C003', '2026-01-08', 19200],
  ['XS-2601-003', 'C002', '2026-01-12', 37000],
  ['XS-2601-004', 'C005', '2026-01-15', 24000],
  ['XS-2601-005', 'C006', '2026-01-19', 42000],
  ['XS-2601-006', 'C001', '2026-01-22', 33600],
  ['XS-2601-007', 'C003', '2026-01-26', 15000],
  ['XS-2601-008', 'C002', '2026-01-29', 48000],
  ['XS-2601-009', 'C004', '2026-01-30', 70000],
  ['XS-2602-001', 'C005', '2026-02-03', 29000],
  ['XS-2602-002', 'C001', '2026-02-06', 62000],
  ['XS-2602-003', 'C006', '2026-02-10', 22400],
  ['XS-2602-004', 'C002', '2026-02-13', 39600],
  ['XS-2602-005', 'C004', '2026-02-17', 52000],
  ['XS-2602-006', 'C003', '2026-02-20', 17600],
  ['XS-2602-007', 'C001', '2026-02-24', 45000],
  ['XS-2602-008', 'C005', '2026-02-27', 20000],
  ['XS-2602-009', 'C006', '2026-02-28', 18000],
  ['XS-2603-001', 'C002', '2026-03-02', 46000],
  ['XS-2603-002', 'C006', '2026-03-05', 35200],
  ['XS-2603-003', 'C001', '2026-03-09', 59000],
  ['XS-2603-004', 'C004', '2026-03-12', 60000],
  ['XS-2603-005', 'C003', '2026-03-16', 19800],
  ['XS-2603-006', 'C005', '2026-03-19', 20000],
  ['XS-2603-007', 'C002', '2026-03-23', 31200],
  ['XS-2603-008', 'C001', '2026-03-26', 52800],
  ['XS-2603-009', 'C006', '2026-03-30', 25600],
  ['XS-2603-010', 'C003', '2026-03-31', 13000],
];
const custName = Object.fromEntries(customers.map((c) => [c[0], c[1]]));
const vendName = Object.fromEntries(vendors.map((v) => [v[0], v[1]]));
for (const [no, cust, date, net] of sales) {
  const tax = cents(net * 0.13), total = cents(net) + tax;
  // The last invoice of the quarter is entered in the evening of 03-31 (a date-boundary example in lesson 6).
  const created = no === 'XS-2603-010' ? '2026-03-31 18:20:00' : null;
  const v = voucher(date, `销售给${custName[cust]}，发票 ${no}`, [L('1122', total, 0, { cust }), L('6001', 0, cents(net)), L('2221', 0, tax)], { created, order: 2 });
  arInvoices.push({ no, cust, date, due: addDays(date, creditDays[cust]), net: cents(net), tax, total, v });
}

// Receipts: [receipt no, customer, date, [[invoice no, 'full' | partial amount], ...]].
// The receipt amount is the sum of what it pays; an unapplied receipt states its amount instead.
const receipts = [
  ['SK-2601-001', 'C001', '2026-01-10', [['XS-2512-007', 'full']]],
  ['SK-2601-002', 'C002', '2026-01-28', [['XS-2512-015', 'full']]],
  ['SK-2601-003', 'C003', '2026-01-30', [['XS-2601-002', 'full']]],
  ['SK-2602-001', 'C001', '2026-02-04', [['XS-2601-001', 'full']]],
  ['SK-2602-002', 'C002', '2026-02-11', [['XS-2601-003', 'full']]],
  ['SK-2602-003', 'C006', '2026-02-12', [['XS-2512-022', 'full']]],
  ['SK-2602-004', 'C005', '2026-02-14', [['XS-2601-004', 'full']]],
  ['SK-2602-005', 'C001', '2026-02-25', [['XS-2601-006', 'full']]],
  ['SK-2602-006', 'C004', '2026-02-26', [['XS-2511-021', 40000]]],   // partial
  ['SK-2602-007', 'C003', '2026-02-27', [['XS-2601-007', 'full']]],
  ['SK-2603-001', 'C006', '2026-03-02', [['XS-2601-005', 27460]]],   // partial, 20,000.00 left open
  ['SK-2603-002', 'C005', '2026-03-05', [['XS-2602-001', 'full']]],
  ['SK-2603-003', 'C002', '2026-03-06', [['XS-2601-008', 'full']]],
  ['SK-2603-004', 'C001', '2026-03-10', [['XS-2602-002', 'full'], ['XS-2602-007', 'full']]], // one receipt, two invoices
  ['SK-2603-005', 'C003', '2026-03-20', [['XS-2602-006', 'full']]],
  ['SK-2603-006', 'C006', '2026-03-24', [['XS-2602-003', 'full']]],
  ['SK-2603-007', 'C002', '2026-03-25', [['XS-2602-004', 20000]]],   // partial
  ['SK-2603-008', 'C005', '2026-03-27', [], 22600], // planted: received and posted, not applied to any invoice
];
for (const [no, cust, date, spec, unappliedAmount] of receipts) {
  const apply = spec.map(([inv, a]) => {
    const i = arInvoices.find((x) => x.no === inv);
    assert(i && i.cust === cust, `receipt ${no} applies to its customer's invoice ${inv}`);
    return [inv, a === 'full' ? i.total : cents(a)];
  });
  const amount = apply.length ? apply.reduce((s, [, a]) => s + a, 0) : cents(unappliedAmount);
  const v = voucher(date, `收到${custName[cust]}货款`, [L('1002', amount), L('1122', 0, amount, { cust })], { order: 3 });
  arReceipts.push({ no, cust, date, amount, v, apply });
}

// Purchases of goods: [vendor invoice no, vendor, date, net]; VAT 13% deductible.
const purchases = [
  ['03317402', 'S001', '2026-01-06', 120000],
  ['04411205', 'S002', '2026-01-14', 60000],
  ['05520018', 'S003', '2026-01-21', 80000],
  ['03317655', 'S001', '2026-02-05', 100000],
  ['04418827', 'S002', '2026-02-16', 70000],
  ['05520391', 'S003', '2026-02-23', 60000],
  ['03318010', 'S001', '2026-03-04', 140000],
  ['04419502', 'S002', '2026-03-17', 50000],
  ['05520777', 'S003', '2026-03-25', 90000],
];
function purchase(no, vend, date, net, { entered = date } = {}) {
  const tax = cents(net * 0.13), total = cents(net) + tax;
  const v = voucher(entered, `收到${vendName[vend]}发票 ${no}，商品入库`, [L('1405', cents(net)), L('2221', tax), L('2202', 0, total, { vend })], { order: 2 });
  apInvoices.push({ no, vend, date, due: addDays(date, payDays[vend]), net: cents(net), tax, total, v });
}
for (const p of purchases) purchase(...p);
// Planted duplicate: the same vendor invoice entered again two days later and posted again.
purchase('04418827', 'S002', '2026-02-16', 70000, { entered: '2026-02-18' });

// Rent (普通发票, no deductible VAT) and freight, booked as expenses through AP.
const services = [
  ['00872301', 'S004', '2026-01-01', 12000, '6602', 'D01', '1月办公室租金'],
  ['00872388', 'S004', '2026-02-01', 12000, '6602', 'D01', '2月办公室租金'],
  ['00872465', 'S004', '2026-03-01', 12000, '6602', 'D01', '3月办公室租金'],
  ['KY260131', 'S005', '2026-01-31', 4360, '6601', 'D03', '1月运费'],
  ['KY260228', 'S005', '2026-02-28', 3815, '6601', 'D03', '2月运费'],
  ['KY260331', 'S005', '2026-03-31', 4905, '6601', 'D03', '3月运费'],
];
for (const [no, vend, date, amount, acct, dept, desc] of services) {
  const v = voucher(date, `${desc}（${vendName[vend]}发票 ${no}）`, [L(acct, cents(amount), 0, { dept }), L('2202', 0, cents(amount), { vend })], { order: 2 });
  apInvoices.push({ no, vend, date, due: addDays(date, payDays[vend]), net: cents(amount), tax: 0, total: cents(amount), v });
}

// AP payments: [payment no, vendor, date, [[vendor invoice no, invoice date], ...]] paid in full.
const payments = [
  ['FK-2601-001', 'S004', '2026-01-05', [['00872210', '2025-12-25']]],
  ['FK-2601-002', 'S004', '2026-01-06', [['00872301', '2026-01-01']]],
  ['FK-2601-003', 'S001', '2026-01-08', [['03317265', '2025-12-10']]],
  ['FK-2601-004', 'S002', '2026-01-30', [['04410931', '2025-12-20']]],
  ['FK-2602-001', 'S004', '2026-02-05', [['00872388', '2026-02-01']]],
  ['FK-2602-002', 'S001', '2026-02-06', [['03317402', '2026-01-06']]],
  ['FK-2602-003', 'S003', '2026-02-20', [['05520018', '2026-01-21']]],
  ['FK-2602-004', 'S005', '2026-02-26', [['KY260131', '2026-01-31']]],
  ['FK-2602-005', 'S002', '2026-02-27', [['04411205', '2026-01-14']]],
  ['FK-2603-001', 'S004', '2026-03-05', [['00872465', '2026-03-01']]],
  ['FK-2603-002', 'S001', '2026-03-06', [['03317655', '2026-02-05']]],
  ['FK-2603-003', 'S003', '2026-03-20', [['05520391', '2026-02-23']]],
  ['FK-2603-004', 'S005', '2026-03-26', [['KY260228', '2026-02-28']]],
  ['FK-2603-005', 'S002', '2026-03-30', [['04418827', '2026-02-16']]], // pays ONE of the two duplicate records
];
for (const [no, vend, date, invs] of payments) {
  const apply = invs.map(([ino, idate]) => {
    const idx = apInvoices.findIndex((x) => x.no === ino && x.vend === vend && x.date === idate);
    assert(idx >= 0, `payment ${no} finds invoice ${ino}`);
    return [idx, apInvoices[idx].total];
  });
  const amount = apply.reduce((s, [, a]) => s + a, 0);
  const what = { S004: '房租', S005: '运费' }[vend] || '货款'; // rent and freight are not payments for goods
  const v = voucher(date, `支付${vendName[vend]}${what}`, [L('2202', amount, 0, { vend }), L('1002', 0, amount)], { order: 3 });
  apPayments.push({ no, vend, date, amount, v, apply });
}

// Payroll: accrue at month end (Dr expense by department / Cr 2211), pay on the 10th of the next month.
const payroll = [
  ['2026-01-31', '1月', { D01: 12000, D02: 18600, D03: 8000, D04: 7000 }],
  ['2026-02-28', '2月', { D01: 12000, D02: 17500, D03: 8000, D04: 7000 }],
  ['2026-03-31', '3月', { D01: 12000, D02: 19200, D03: 8000, D04: 7000 }],
];
const salaryAcct = { D01: '6602', D02: '6601', D03: '6601', D04: '6602' };
for (const [date, mon, byDept] of payroll) {
  const lines = Object.entries(byDept).map(([d, a]) => L(salaryAcct[d], cents(a), 0, { dept: d }));
  const total = lines.reduce((s, l) => s + l.dr, 0);
  lines.push(L('2211', 0, total));
  // The January accrual is entered the next morning: voucher date (period) and entry time differ.
  voucher(date, `计提${mon}工资`, lines, { order: 8, created: date === '2026-01-31' ? '2026-02-01 09:15:00' : `${date} 17:30:00` });
}
const payrollPaid = [['2026-01-10', '12月', opening.payroll * 100], ['2026-02-10', '1月', null], ['2026-03-10', '2月', null]];
for (const [date, mon, amt] of payrollPaid) {
  const amount = amt ?? vouchers.find((v) => v.desc === `计提${mon}工资`).lines.at(-1).cr;
  voucher(date, `发放${mon}工资`, [L('2211', amount), L('1002', 0, amount)], { order: 3 });
}

// Depreciation, bank fees, interest, cash withdrawal.
for (const [date, mon] of [['2026-01-31', '1月'], ['2026-02-28', '2月'], ['2026-03-31', '3月']]) {
  voucher(date, `计提${mon}折旧`, [L('6602', 200000, 0, { dept: 'D01' }), L('1602', 0, 200000)], { order: 8, created: `${date} 17:40:00` });
}
for (const [date, amt] of [['2026-01-31', 86.5], ['2026-02-27', 72], ['2026-03-31', 95.5]]) {
  voucher(date, '银行手续费', [L('6603', cents(amt), 0, { dept: 'D04' }), L('1002', 0, cents(amt))], { order: 7 });
}
voucher('2026-03-21', '一季度银行存款利息', [L('1002', 31240), L('6603', 0, 31240, { dept: 'D04' })], { order: 7 });
voucher('2026-02-02', '从银行提取备用金', [L('1001', 200000), L('1002', 0, 200000)], { order: 4 });

// Day-to-day expenses: [day, dept, acct, text, base, paidFrom]
const expenseTemplate = [
  [3, 'D01', '6602', '购买办公用品', 820, '1002'],
  [7, 'D02', '6601', '销售人员差旅费报销', 3600, '1002'],
  [9, 'D04', '6602', '财务部购买凭证纸、文件盒', 360, '1001'],
  [12, 'D02', '6601', '业务招待费', 1850, '1002'],
  [14, 'D01', '6602', '水电费', 2300, '1002'],
  [16, 'D03', '6601', '快递费', 680, '1002'],
  [18, 'D02', '6601', '市内交通费', 280, '1001'],
  [20, 'D01', '6602', '电话和网络费', 620, '1002'],
  [24, 'D02', '6601', '销售人员差旅费报销', 2900, '1002'],
  [27, 'D03', '6601', '仓库包装材料', 950, '1002'],
];
const extras = {
  '01': [[15, 'D04', '6602', '财务人员培训费', 2000, '1002']],
  '02': [[10, 'D02', '6601', '展会广告费', 8000, '1002']],
  '03': [[13, 'D03', '6601', '叉车维修费', 1200, '1002'], [25, 'D02', '6601', '业务招待费', 2600, '1002']],
};
for (const mm of ['01', '02', '03']) {
  const list = [...expenseTemplate, ...extras[mm]].sort((a, b) => a[0] - b[0]);
  for (const [day, dept, acct, text, base, from] of list) {
    const date = `2026-${mm}-${String(day).padStart(2, '0')}`;
    const amt = vary(base);
    voucher(date, text, [L(acct, amt, 0, { dept }), L(from, 0, amt)], { order: 6 });
  }
}
// Planted: unbalanced voucher (credit side typed with two digits swapped).
const unbalanced = voucher('2026-03-11', '购买打印纸、硒鼓', [L('6602', 135000, 0, { dept: 'D01' }), L('1002', 0, 153000)], { order: 6, created: '2026-03-11 15:42:00' });

// VAT: pay last month's net VAT (output - input) on the 15th.
const vatOf = (mm) => {
  let out = 0, inp = 0;
  for (const v of vouchers) {
    if (v.date.slice(5, 7) !== mm || v.desc === '期初余额' || v.desc.startsWith('缴纳')) continue; // output and input VAT only, not payments
    for (const l of v.lines) if (l.acct === '2221') { out += l.cr; inp += l.dr; }
  }
  return out - inp;
};
voucher('2026-01-15', '缴纳12月增值税', [L('2221', cents(opening.vat)), L('1002', 0, cents(opening.vat))], { order: 3 });
for (const [date, mm, mon] of [['2026-02-15', '01', '1月'], ['2026-03-15', '02', '2月']]) {
  const due = vatOf(mm);
  assert(due > 0, `VAT for ${mon} is payable`);
  voucher(date, `缴纳${mon}增值税`, [L('2221', due), L('1002', 0, due)], { order: 3 });
}

// Cost of goods sold at month end: 72% of the month's net sales.
for (const [date, mm, mon] of [['2026-01-31', '01', '1月'], ['2026-02-28', '02', '2月'], ['2026-03-31', '03', '3月']]) {
  const net = sales.filter((s) => s[2].slice(5, 7) === mm).reduce((s, x) => s + cents(x[3]), 0);
  const cost = Math.round(net * 0.72);
  voucher(date, `结转${mon}销售成本`, [L('6401', cost), L('1405', 0, cost)], { order: 9, created: `${date} 18:00:00` });
}

// ------------------------------------------------------------ numbering
vouchers.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.order - b.order));
const perMonth = {};
vouchers.forEach((v, i) => {
  v.id = i + 1;
  const ym = v.date.slice(0, 7);
  if (v.desc === '期初余额') { v.no = '2025-12-000'; return; }
  perMonth[ym] = (perMonth[ym] || 0) + 1;
  v.no = `${ym}-${String(perMonth[ym]).padStart(3, '0')}`;
});

// ------------------------------------------------------------ budgets (round hundreds; some months over budget)
const actualBy = {};
for (const v of vouchers) for (const l of v.lines) {
  if (!['6601', '6602', '6603'].includes(l.acct) || !l.dept) continue;
  const k = `${v.date.slice(0, 7)}|${l.dept}|${l.acct}`;
  actualBy[k] = (actualBy[k] || 0) + l.dr - l.cr;
}
const factor = { // budget = actual x factor, rounded to 100 yuan
  'D01|6602': [1.04, 1.03, 0.97], 'D02|6601': [1.06, 0.88, 0.95], 'D03|6601': [1.05, 1.08, 0.93],
  'D04|6602': [1.02, 1.30, 1.10], 'D04|6603': [1.2, 1.4, 1.0],
};
const budgets = [];
['2026-01', '2026-02', '2026-03'].forEach((ym, i) => {
  for (const [k, f] of Object.entries(factor)) {
    const [dept, acct] = k.split('|');
    const actual = actualBy[`${ym}|${dept}|${acct}`] || 0;
    const amt = acct === '6603' ? 10000 : Math.max(100, Math.round((actual * f[i]) / 10000)) * 10000; // 6603: flat 100 yuan
    budgets.push([ym, dept, acct, amt]);
  }
  budgets.push([ym, 'D03', '6602', 50000]); // budgeted but never spent (LEFT JOIN / NULL example)
});

// ------------------------------------------------------------ invariants
const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
for (const v of vouchers) {
  const d = sum(v.lines, (l) => l.dr), c = sum(v.lines, (l) => l.cr);
  if (v === unbalanced) assert(d - c === -18000, 'planted voucher is off by 180.00');
  else assert(d === c, `voucher ${v.no} balances`);
  for (const l of v.lines) assert((l.dr > 0) !== (l.cr > 0), `voucher ${v.no}: each line is either debit or credit`);
}
const gl = (acct, f = () => true) => sum(vouchers.flatMap((v) => v.lines.filter((l) => l.acct === acct && f(l, v))), (l) => l.dr - l.cr);
const applied = new Map();
for (const r of arReceipts) for (const [inv, a] of r.apply) applied.set(inv, (applied.get(inv) || 0) + a);
for (const r of arReceipts) assert(sum(r.apply, (x) => x[1]) <= r.amount, `receipt ${r.no} not over-applied`);
const arOpen = sum(arInvoices, (i) => i.total - (applied.get(i.no) || 0));
for (const i of arInvoices) assert(i.total - (applied.get(i.no) || 0) >= 0, `invoice ${i.no} not over-paid`);
const unappliedAR = sum(arReceipts, (r) => r.amount - sum(r.apply, (x) => x[1]));
assert(gl('1122') === arOpen - unappliedAR, `AR control ${gl('1122')} = open invoices ${arOpen} - unapplied ${unappliedAR}`);
for (const [cid] of customers) {
  const open = sum(arInvoices.filter((i) => i.cust === cid), (i) => i.total - (applied.get(i.no) || 0));
  const un = sum(arReceipts.filter((r) => r.cust === cid), (r) => r.amount - sum(r.apply, (x) => x[1]));
  assert(gl('1122', (l) => l.cust === cid) === open - un, `AR ${cid} ties`);
}
const apPaid = new Map();
for (const p of apPayments) for (const [idx, a] of p.apply) apPaid.set(idx, (apPaid.get(idx) || 0) + a);
const apOpen = sum(apInvoices.map((x, i) => [x, i]), ([x, i]) => x.total - (apPaid.get(i) || 0));
assert(-gl('2202') === apOpen, `AP control ${-gl('2202')} = open AP ${apOpen}`);
for (const mmEnd of ['2026-01-31', '2026-02-28', '2026-03-31']) {
  for (const acct of ['1001', '1002', '1405']) assert(gl(acct, (l, v) => v.date <= mmEnd) > 0, `${acct} positive at ${mmEnd}`);
}
const byCat = (cat) => sum(accounts.filter((a) => a[2] === cat), (a) => gl(a[0]));
const assets = byCat('资产'), liab = -byCat('负债'), equity = -byCat('所有者权益'), profit = -byCat('损益');
assert(assets - (liab + equity + profit) === -18000, 'balance sheet is off by exactly the planted 180.00');
const lineCount = sum(vouchers, (v) => v.lines.length);
assert(lineCount >= 250 && lineCount <= 450, `a few hundred voucher lines (${lineCount})`);

// ------------------------------------------------------------ SQL
const out = [];
const w = (s) => out.push(s);
w(`-- 练习数据：会计人的 MySQL（课程配套）
-- 虚构公司：晴川文具贸易有限公司，2026 年 1-3 月，人民币。所有公司、人名、发票号均为虚构。
-- 由 web/tools/build-practice-data.mjs 生成，请不要手改；导入多少次结果都一样（不用随机数）。
--
-- 导入：mysql -u root < schema-and-data.sql
-- 注意：第一行会删除并重建数据库 acct_practice（只影响这个练习库）。
--
-- 简化说明：增值税统一记在 2221 应交税费；不计提所得税；
-- 损益类科目季度内不结转（表结法），所以利润 = 损益类科目的发生额。

DROP DATABASE IF EXISTS acct_practice;
CREATE DATABASE acct_practice DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE acct_practice;

CREATE TABLE departments (
  dept_id    VARCHAR(10) NOT NULL PRIMARY KEY COMMENT '部门编号',
  dept_name  VARCHAR(50) NOT NULL COMMENT '部门名称'
) COMMENT='部门';

CREATE TABLE accounts (
  account_code VARCHAR(10) NOT NULL PRIMARY KEY COMMENT '科目代码',
  account_name VARCHAR(50) NOT NULL COMMENT '科目名称',
  category     VARCHAR(10) NOT NULL COMMENT '科目类别：资产/负债/所有者权益/损益',
  balance_side VARCHAR(1)  NOT NULL COMMENT '余额方向：借/贷'
) COMMENT='会计科目表';

CREATE TABLE customers (
  customer_id   VARCHAR(10)  NOT NULL PRIMARY KEY COMMENT '客户编号',
  customer_name VARCHAR(100) NOT NULL COMMENT '客户名称',
  city          VARCHAR(20)  NOT NULL COMMENT '城市',
  credit_days   INT          NOT NULL COMMENT '信用期（天）',
  contact_phone VARCHAR(20)  NULL     COMMENT '联系电话，可能为空'
) COMMENT='客户';

CREATE TABLE vendors (
  vendor_id    VARCHAR(10)  NOT NULL PRIMARY KEY COMMENT '供应商编号',
  vendor_name  VARCHAR(100) NOT NULL COMMENT '供应商名称',
  payment_days INT          NOT NULL COMMENT '付款期（天）'
) COMMENT='供应商';

CREATE TABLE vouchers (
  voucher_id   INT          NOT NULL PRIMARY KEY COMMENT '凭证内部编号',
  voucher_no   VARCHAR(20)  NOT NULL UNIQUE COMMENT '凭证号：年-月-序号',
  voucher_date DATE         NOT NULL COMMENT '凭证日期（决定属于哪个会计期间）',
  description  VARCHAR(200) NOT NULL COMMENT '摘要',
  created_at   DATETIME     NOT NULL COMMENT '录入系统的时间'
) COMMENT='凭证头';

CREATE TABLE voucher_lines (
  line_id      INT           NOT NULL PRIMARY KEY COMMENT '分录行编号',
  voucher_id   INT           NOT NULL COMMENT '属于哪张凭证',
  line_no      INT           NOT NULL COMMENT '凭证内第几行',
  account_code VARCHAR(10)   NOT NULL COMMENT '科目代码',
  dept_id      VARCHAR(10)   NULL     COMMENT '部门（辅助核算，费用行才有）',
  customer_id  VARCHAR(10)   NULL     COMMENT '客户（辅助核算，应收行才有）',
  vendor_id    VARCHAR(10)   NULL     COMMENT '供应商（辅助核算，应付行才有）',
  debit        DECIMAL(14,2) NOT NULL DEFAULT 0 COMMENT '借方金额',
  credit       DECIMAL(14,2) NOT NULL DEFAULT 0 COMMENT '贷方金额',
  FOREIGN KEY (voucher_id)   REFERENCES vouchers (voucher_id),
  FOREIGN KEY (account_code) REFERENCES accounts (account_code),
  FOREIGN KEY (dept_id)      REFERENCES departments (dept_id),
  FOREIGN KEY (customer_id)  REFERENCES customers (customer_id),
  FOREIGN KEY (vendor_id)    REFERENCES vendors (vendor_id)
) COMMENT='凭证分录行';

CREATE TABLE ar_invoices (
  invoice_id   INT           NOT NULL PRIMARY KEY COMMENT '应收发票内部编号',
  invoice_no   VARCHAR(20)   NOT NULL COMMENT '发票号',
  customer_id  VARCHAR(10)   NOT NULL COMMENT '客户',
  invoice_date DATE          NOT NULL COMMENT '开票日期',
  due_date     DATE          NOT NULL COMMENT '到期日 = 开票日期 + 信用期',
  net_amount   DECIMAL(14,2) NOT NULL COMMENT '不含税金额',
  tax_amount   DECIMAL(14,2) NOT NULL COMMENT '税额',
  total_amount DECIMAL(14,2) NOT NULL COMMENT '价税合计（应收金额）',
  voucher_id   INT           NOT NULL COMMENT '记账凭证',
  FOREIGN KEY (customer_id) REFERENCES customers (customer_id),
  FOREIGN KEY (voucher_id)  REFERENCES vouchers (voucher_id)
) COMMENT='应收发票（销售开票）';

CREATE TABLE ar_receipts (
  receipt_id   INT           NOT NULL PRIMARY KEY COMMENT '收款内部编号',
  receipt_no   VARCHAR(20)   NOT NULL UNIQUE COMMENT '收款单号',
  customer_id  VARCHAR(10)   NOT NULL COMMENT '付款客户',
  receipt_date DATE          NOT NULL COMMENT '收款日期',
  amount       DECIMAL(14,2) NOT NULL COMMENT '收款金额',
  voucher_id   INT           NOT NULL COMMENT '记账凭证',
  FOREIGN KEY (customer_id) REFERENCES customers (customer_id),
  FOREIGN KEY (voucher_id)  REFERENCES vouchers (voucher_id)
) COMMENT='客户收款';

CREATE TABLE ar_receipt_applications (
  receipt_id     INT           NOT NULL COMMENT '哪笔收款',
  invoice_id     INT           NOT NULL COMMENT '核销到哪张发票',
  applied_amount DECIMAL(14,2) NOT NULL COMMENT '核销金额',
  PRIMARY KEY (receipt_id, invoice_id),
  FOREIGN KEY (receipt_id) REFERENCES ar_receipts (receipt_id),
  FOREIGN KEY (invoice_id) REFERENCES ar_invoices (invoice_id)
) COMMENT='收款核销明细：一笔收款可以核销多张发票';

CREATE TABLE ap_invoices (
  invoice_id   INT           NOT NULL PRIMARY KEY COMMENT '应付发票内部编号',
  invoice_no   VARCHAR(20)   NOT NULL COMMENT '供应商开来的发票号',
  vendor_id    VARCHAR(10)   NOT NULL COMMENT '供应商',
  invoice_date DATE          NOT NULL COMMENT '发票日期',
  due_date     DATE          NOT NULL COMMENT '到期日 = 发票日期 + 付款期',
  net_amount   DECIMAL(14,2) NOT NULL COMMENT '不含税金额（普通发票为全额）',
  tax_amount   DECIMAL(14,2) NOT NULL COMMENT '可抵扣进项税额',
  total_amount DECIMAL(14,2) NOT NULL COMMENT '价税合计（应付金额）',
  voucher_id   INT           NOT NULL COMMENT '记账凭证',
  FOREIGN KEY (vendor_id)  REFERENCES vendors (vendor_id),
  FOREIGN KEY (voucher_id) REFERENCES vouchers (voucher_id)
) COMMENT='应付发票（采购和费用）';

CREATE TABLE ap_payments (
  payment_id   INT           NOT NULL PRIMARY KEY COMMENT '付款内部编号',
  payment_no   VARCHAR(20)   NOT NULL UNIQUE COMMENT '付款单号',
  vendor_id    VARCHAR(10)   NOT NULL COMMENT '收款供应商',
  payment_date DATE          NOT NULL COMMENT '付款日期',
  amount       DECIMAL(14,2) NOT NULL COMMENT '付款金额',
  voucher_id   INT           NOT NULL COMMENT '记账凭证',
  FOREIGN KEY (vendor_id)  REFERENCES vendors (vendor_id),
  FOREIGN KEY (voucher_id) REFERENCES vouchers (voucher_id)
) COMMENT='向供应商付款';

CREATE TABLE ap_payment_applications (
  payment_id     INT           NOT NULL COMMENT '哪笔付款',
  invoice_id     INT           NOT NULL COMMENT '核销到哪张应付发票',
  applied_amount DECIMAL(14,2) NOT NULL COMMENT '核销金额',
  PRIMARY KEY (payment_id, invoice_id),
  FOREIGN KEY (payment_id) REFERENCES ap_payments (payment_id),
  FOREIGN KEY (invoice_id) REFERENCES ap_invoices (invoice_id)
) COMMENT='付款核销明细';

CREATE TABLE budgets (
  budget_month VARCHAR(7)    NOT NULL COMMENT '预算月份，如 2026-01',
  dept_id      VARCHAR(10)   NOT NULL COMMENT '部门',
  account_code VARCHAR(10)   NOT NULL COMMENT '费用科目',
  amount       DECIMAL(14,2) NOT NULL COMMENT '预算金额',
  PRIMARY KEY (budget_month, dept_id, account_code),
  FOREIGN KEY (dept_id)      REFERENCES departments (dept_id),
  FOREIGN KEY (account_code) REFERENCES accounts (account_code)
) COMMENT='月度费用预算';
`);
const insert = (table, cols, rows) => {
  w(`INSERT INTO ${table} (${cols.join(', ')}) VALUES`);
  w(rows.map((r) => '  (' + r.map(q).join(', ') + ')').join(',\n') + ';\n');
};
insert('departments', ['dept_id', 'dept_name'], departments);
insert('accounts', ['account_code', 'account_name', 'category', 'balance_side'], accounts);
insert('customers', ['customer_id', 'customer_name', 'city', 'credit_days', 'contact_phone'], customers);
insert('vendors', ['vendor_id', 'vendor_name', 'payment_days'], vendors);
insert('vouchers', ['voucher_id', 'voucher_no', 'voucher_date', 'description', 'created_at'], vouchers.map((v) => [v.id, v.no, v.date, v.desc, v.created]));
let lineId = 0;
insert('voucher_lines', ['line_id', 'voucher_id', 'line_no', 'account_code', 'dept_id', 'customer_id', 'vendor_id', 'debit', 'credit'],
  vouchers.flatMap((v) => v.lines.map((l, i) => [++lineId, v.id, i + 1, l.acct, l.dept, l.cust, l.vend, money(l.dr), money(l.cr)])));
arInvoices.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.no < b.no ? -1 : 1)).forEach((x, i) => { x.id = i + 1; });
insert('ar_invoices', ['invoice_id', 'invoice_no', 'customer_id', 'invoice_date', 'due_date', 'net_amount', 'tax_amount', 'total_amount', 'voucher_id'],
  arInvoices.map((x) => [x.id, x.no, x.cust, x.date, x.due, money(x.net), money(x.tax), money(x.total), x.v.id]));
arReceipts.forEach((x, i) => { x.id = i + 1; });
insert('ar_receipts', ['receipt_id', 'receipt_no', 'customer_id', 'receipt_date', 'amount', 'voucher_id'], arReceipts.map((x) => [x.id, x.no, x.cust, x.date, money(x.amount), x.v.id]));
insert('ar_receipt_applications', ['receipt_id', 'invoice_id', 'applied_amount'],
  arReceipts.flatMap((r) => r.apply.map(([inv, a]) => [r.id, arInvoices.find((x) => x.no === inv).id, money(a)])));
const apSorted = apInvoices.map((x, i) => ({ ...x, orig: i })).sort((a, b) => (a.v.id - b.v.id));
apSorted.forEach((x, i) => { x.id = i + 1; });
const apIdOf = new Map(apSorted.map((x) => [x.orig, x.id]));
insert('ap_invoices', ['invoice_id', 'invoice_no', 'vendor_id', 'invoice_date', 'due_date', 'net_amount', 'tax_amount', 'total_amount', 'voucher_id'],
  apSorted.map((x) => [x.id, x.no, x.vend, x.date, x.due, money(x.net), money(x.tax), money(x.total), x.v.id]));
apPayments.forEach((x, i) => { x.id = i + 1; });
insert('ap_payments', ['payment_id', 'payment_no', 'vendor_id', 'payment_date', 'amount', 'voucher_id'], apPayments.map((x) => [x.id, x.no, x.vend, x.date, money(x.amount), x.v.id]));
insert('ap_payment_applications', ['payment_id', 'invoice_id', 'applied_amount'],
  apPayments.flatMap((p) => p.apply.map(([idx, a]) => [p.id, apIdOf.get(idx), money(a)])));
insert('budgets', ['budget_month', 'dept_id', 'account_code', 'amount'], budgets.map((b) => [b[0], b[1], b[2], money(b[3])]));

if (process.argv.includes('--stdout')) { process.stdout.write(out.join('\n')); process.exit(0); } // used by tests/course-packs.test.mjs
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, out.join('\n'));
console.log(`wrote ${path.relative(WEB, OUT)}: ${vouchers.length} vouchers, ${lineCount} voucher lines, ${arInvoices.length} AR invoices, ${apInvoices.length} AP invoices`);
console.log(`AR control ${money(gl('1122'))} = open invoices ${money(arOpen)} - unapplied receipts ${money(unappliedAR)}; AP control ${money(-gl('2202'))}`);
console.log(`assets ${money(assets)} vs liabilities ${money(liab)} + equity ${money(equity)} + profit ${money(profit)} (difference ${money(assets - liab - equity - profit)} = planted voucher)`);
