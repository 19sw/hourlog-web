// Runs every SQL statement of the course "会计人的 MySQL" against a real MySQL
// server and checks the results the course states. Not part of `node --test`
// (it needs MySQL). Run it from web/ before publishing a change to the course,
// the practice data or answers.sql:
//
//   MYSQL=/path/to/bin/mysql MYSQL_ARGS="--defaults-file=/path/to/my.cnf -u root" node tools/check-course-sql.mjs
//
// MYSQL defaults to `mysql` on PATH and MYSQL_ARGS to `-u root`. The account
// needs to create/drop the database acct_practice and (lesson 15) a user.
//
// What it checks:
//   1. practice/mysql-accounting/schema-and-data.sql imports cleanly twice in a
//      row and gives identical tables (CHECKSUM TABLE), with no RAND()/NOW().
//   2. Every code block in the course pack (lesson sections, quiz and assessment
//      questions) runs without error. A block with `result` must return exactly
//      that result; a question's code must return the result recorded in
//      tools/course-sql-expect.json.
//   3. Every statement in answers.sql runs; a statement with "-- 预期结果：" must
//      return exactly the "-- | ..." rows below that line.
//   4. ```sql blocks in practice/mysql-accounting/README.md run.
//   5. Accounting reconciliations: the trial balance balances once the planted
//      unbalanced voucher is excluded (and is off by exactly that voucher with
//      it); AR aging minus unapplied receipts ties to account 1122; AP open
//      items tie to 2202; the planted issues are found.
//   6. Running everything left the data unchanged (same checksums as after import).
//
// `--write` refreshes the stated results from MySQL instead of comparing
// (pack `result:` strings, course-sql-expect.json, answers.sql "-- |" rows).
// Review the diff afterwards: every number in the prose must still agree.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACK_FILE = path.join(WEB, 'courses', 'mysql-for-accounting.js');
const PRACTICE = path.join(WEB, 'practice', 'mysql-accounting');
const EXPECT_FILE = path.join(WEB, 'tools', 'course-sql-expect.json');
const WRITE = process.argv.includes('--write');
const MYSQL = process.env.MYSQL || 'mysql';
const MYSQL_ARGS = (process.env.MYSQL_ARGS || '-u root').split(/\s+/).filter(Boolean);
const DB = 'acct_practice';

let failures = 0;
let ran = 0;
const fail = (msg) => { failures++; console.log('  FAIL ' + msg); };
const short = (sql) => sql.replace(/\s+/g, ' ').trim().slice(0, 90);

function mysql(sql, { db = DB, input = null, names = true } = {}) {
  const args = [...MYSQL_ARGS, '--batch', '--default-character-set=utf8mb4'];
  if (!names) args.push('--skip-column-names');
  if (db) args.push(db);
  if (input === null) args.push('-e', sql);
  const r = spawnSync(MYSQL, args, { input: input ?? undefined, encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.error) throw new Error(`cannot run ${MYSQL}: ${r.error.message}`);
  return { ok: r.status === 0, out: (r.stdout || '').replace(/\n$/, ''), err: (r.stderr || '').trim() };
}
const run = (sql, where) => {
  ran++;
  const r = mysql(sql);
  if (!r.ok) fail(`${where}: ${short(sql)}\n       ${r.err}`);
  return r;
};
const scalar = (sql) => { const r = mysql(sql, { names: false }); if (!r.ok) throw new Error(r.err + '\n' + sql); return r.out; };

function checksums() {
  const tables = mysql(`SELECT table_name FROM information_schema.tables WHERE table_schema = '${DB}' ORDER BY table_name`).out.split('\n').slice(1);
  return mysql(`CHECKSUM TABLE ${tables.join(', ')}`).out;
}

// ------------------------------------------------------------ 1. import twice
console.log('1. import practice data twice');
const dataSql = fs.readFileSync(path.join(PRACTICE, 'schema-and-data.sql'), 'utf8');
if (/\b(RAND|NOW|CURDATE|CURRENT_DATE|UUID|SYSDATE)\s*\(/i.test(dataSql)) fail('schema-and-data.sql uses a non-deterministic function');
let firstSums = null;
for (const n of [1, 2]) {
  const r = mysql(null, { db: null, input: dataSql });
  if (!r.ok) { fail(`import ${n}: ${r.err}`); break; }
  const sums = checksums();
  if (n === 1) firstSums = sums;
  else if (sums !== firstSums) fail('second import differs from the first');
  console.log(`  import ${n} ok`);
}
const lineCount = scalar('SELECT COUNT(*) FROM voucher_lines');
console.log(`  ${lineCount} voucher lines, ${scalar('SELECT COUNT(*) FROM vouchers')} vouchers`);

// lesson 15 creates this user; start from a clean state so CREATE USER behaves as for a learner
mysql("DROP USER IF EXISTS 'acct_reader'@'localhost'", { db: null });

// ------------------------------------------------------------ 2. course pack
console.log('2. course pack code blocks');
const pack = (await import(pathToFileURL(PACK_FILE).href + '?t=' + Date.now())).default;
const expect = fs.existsSync(EXPECT_FILE) ? JSON.parse(fs.readFileSync(EXPECT_FILE, 'utf8')) : {};
const newResults = new Map(); // sql -> tsv (for --write of the pack)
const newExpect = {};
let blocks = 0, withResult = 0;
for (const node of pack.nodes) {
  for (const sec of node.lesson.sections) {
    for (const item of sec.body) {
      if (typeof item === 'string' || item.lang === 'shell') continue;
      blocks++;
      const r = run(item.code, `${node.id} / ${sec.heading}`);
      if (!r.ok || item.result === undefined) continue;
      withResult++;
      newResults.set(item.code, r.out);
      if (!WRITE && r.out !== item.result && !(r.out === '' && !item.result.includes('\n'))) {
        fail(`${node.id} / ${sec.heading}: result differs\n       SQL: ${short(item.code)}\n       stated: ${JSON.stringify(item.result)}\n       actual: ${JSON.stringify(r.out)}`);
      }
    }
  }
}
const questions = [...pack.nodes.flatMap((n) => n.lesson.quiz), ...pack.assessment.questions];
for (const q of questions) {
  if (!q.code) continue;
  blocks++;
  const r = run(q.code, `question ${q.id}`);
  if (!r.ok) continue;
  newExpect[q.id] = r.out;
  if (!WRITE) {
    if (!(q.id in expect)) fail(`question ${q.id}: no recorded result in course-sql-expect.json`);
    else if (expect[q.id] !== r.out) fail(`question ${q.id}: result differs\n       recorded: ${JSON.stringify(expect[q.id])}\n       actual:   ${JSON.stringify(r.out)}`);
  }
}
for (const id of Object.keys(expect)) if (!questions.some((q) => q.id === id && q.code)) fail(`course-sql-expect.json has ${id}, which is not a question with code`);
console.log(`  ${blocks} code blocks run, ${withResult} lesson results compared, ${Object.keys(newExpect).length} question results compared`);

// ------------------------------------------------------------ 3. answers.sql
console.log('3. answers.sql');
const ANSWERS = path.join(PRACTICE, 'answers.sql');
const answerLines = fs.readFileSync(ANSWERS, 'utf8').split('\n');
const fmtRows = (tsv) => (tsv === '' ? ['-- | （没有查到任何行）'] : tsv.split('\n').map((l) => '-- | ' + l.split('\t').join(' | ')));
{
  const out = [];
  let sqlBuf = [];
  let expectAt = -1; // index in `out` of the "-- 预期结果：" line of the current statement
  let expected = [];
  let stmts = 0, compared = 0;
  // START TRANSACTION ... ROLLBACK must run in ONE session (each run() is a new
  // connection, where a lone UPDATE would autocommit), so such a group is
  // collected and run as one unit; its stated result is the group's output.
  let txUnit = null;
  for (const line of answerLines) {
    if (line.startsWith('-- |')) { expected.push(line); if (!WRITE) out.push(line); continue; }
    if (sqlBuf.length === 0 && line.startsWith('--')) {
      if (line.startsWith('-- 预期结果：')) { expectAt = out.length; expected = []; }
      out.push(line);
      continue;
    }
    if (sqlBuf.length === 0 && line.trim() === '') { out.push(line); continue; }
    sqlBuf.push(line);
    out.push(line);
    if (/;\s*$/.test(line)) {
      const stmt = sqlBuf.join('\n');
      sqlBuf = [];
      stmts++;
      if (/^\s*START TRANSACTION/i.test(stmt)) txUnit = [];
      if (txUnit) {
        txUnit.push(stmt);
        if (!/^\s*ROLLBACK/i.test(stmt)) continue;
        if (!txUnit.some((s) => /^\s*SELECT/i.test(s)) || !/^\s*ROLLBACK/i.test(txUnit.at(-1))) fail('answers.sql: transaction group must end with ROLLBACK');
      }
      const sql = txUnit ? txUnit.join('\n') : stmt;
      txUnit = null;
      const r = run(sql, 'answers.sql');
      if (expectAt >= 0 && r.ok) {
        compared++;
        const actual = fmtRows(r.out);
        if (WRITE) out.splice(expectAt + 1, 0, ...actual);
        else if (actual.join('\n') !== expected.join('\n')) fail(`answers.sql: result differs for ${short(sql)}\n       stated:\n${expected.join('\n')}\n       actual:\n${actual.join('\n')}`);
      }
      expectAt = -1; expected = [];
    }
  }
  if (sqlBuf.length || txUnit) fail('answers.sql ends with an unterminated statement or transaction');
  if (WRITE) fs.writeFileSync(ANSWERS, out.join('\n'));
  console.log(`  ${stmts} statements run, ${compared} results compared`);
}

// ------------------------------------------------------------ 4. README
console.log('4. README sql blocks');
{
  const md = fs.readFileSync(path.join(PRACTICE, 'README.md'), 'utf8');
  const blocksMd = [...md.matchAll(/```sql\n([\s\S]*?)```/g)].map((m) => m[1]);
  for (const sql of blocksMd) run(sql, 'README.md');
  console.log(`  ${blocksMd.length} blocks run`);
}

// ------------------------------------------------------------ 5. reconciliations
console.log('5. reconciliations');
const PLANTED = '2026-03-016';
const recon = [
  ['planted unbalanced voucher is the only one',
    `SELECT GROUP_CONCAT(voucher_no) FROM (SELECT v.voucher_no FROM vouchers v JOIN voucher_lines l ON l.voucher_id = v.voucher_id GROUP BY v.voucher_no HAVING SUM(l.debit) <> SUM(l.credit)) x`, PLANTED],
  ['trial balance with every voucher is off by the planted 180.00',
    'SELECT SUM(debit) - SUM(credit) FROM voucher_lines', '-180.00'],
  ['trial balance balances after excluding the planted voucher',
    `SELECT SUM(l.debit) - SUM(l.credit) FROM voucher_lines l JOIN vouchers v ON v.voucher_id = l.voucher_id WHERE v.voucher_no <> '${PLANTED}'`, '0.00'],
  ['AR aging (open invoices as of 2026-03-31) - unapplied receipts = GL 1122',
    `SELECT (SELECT SUM(i.total_amount - COALESCE(a.applied, 0)) FROM ar_invoices i LEFT JOIN (SELECT invoice_id, SUM(applied_amount) AS applied FROM ar_receipt_applications GROUP BY invoice_id) a ON a.invoice_id = i.invoice_id)
          - (SELECT SUM(r.amount - COALESCE(a.applied, 0)) FROM ar_receipts r LEFT JOIN (SELECT receipt_id, SUM(applied_amount) AS applied FROM ar_receipt_applications GROUP BY receipt_id) a ON a.receipt_id = r.receipt_id)
          - (SELECT SUM(debit - credit) FROM voucher_lines WHERE account_code = '1122')`, '0.00'],
  ['AR ties per customer too',
    `SELECT COUNT(*) FROM customers c WHERE
       (SELECT COALESCE(SUM(i.total_amount - COALESCE((SELECT SUM(applied_amount) FROM ar_receipt_applications x WHERE x.invoice_id = i.invoice_id), 0)), 0) FROM ar_invoices i WHERE i.customer_id = c.customer_id)
     - (SELECT COALESCE(SUM(r.amount - COALESCE((SELECT SUM(applied_amount) FROM ar_receipt_applications x WHERE x.receipt_id = r.receipt_id), 0)), 0) FROM ar_receipts r WHERE r.customer_id = c.customer_id)
     <> (SELECT COALESCE(SUM(debit - credit), 0) FROM voucher_lines l WHERE l.account_code = '1122' AND l.customer_id = c.customer_id)`, '0'],
  ['AP open invoices = GL 2202 (credit balance)',
    `SELECT (SELECT SUM(i.total_amount - COALESCE(a.applied, 0)) FROM ap_invoices i LEFT JOIN (SELECT invoice_id, SUM(applied_amount) AS applied FROM ap_payment_applications GROUP BY invoice_id) a ON a.invoice_id = i.invoice_id)
          - (SELECT SUM(credit - debit) FROM voucher_lines WHERE account_code = '2202')`, '0.00'],
  ['planted duplicate AP invoice is found',
    'SELECT GROUP_CONCAT(CONCAT(vendor_id, \':\', invoice_no)) FROM (SELECT vendor_id, invoice_no FROM ap_invoices GROUP BY vendor_id, invoice_no HAVING COUNT(*) > 1) d', 'S002:04418827'],
  ['planted unapplied receipt is found',
    'SELECT GROUP_CONCAT(r.receipt_no) FROM ar_receipts r LEFT JOIN ar_receipt_applications a ON a.receipt_id = r.receipt_id WHERE a.receipt_id IS NULL', 'SK-2603-008'],
  ['every voucher line is either a debit or a credit',
    'SELECT COUNT(*) FROM voucher_lines WHERE (debit > 0) = (credit > 0)', '0'],
];
for (const [name, sql, want] of recon) {
  ran++;
  const got = scalar(sql);
  if (got !== want) fail(`${name}: got ${got}, want ${want}`);
  else console.log(`  ok  ${name} (${got})`);
}

// ------------------------------------------------------------ 6. data unchanged
console.log('6. data unchanged after running everything');
if (checksums() !== firstSums) fail('some statement changed the practice data (examples must roll back)');
else console.log('  ok');
mysql("DROP USER IF EXISTS 'acct_reader'@'localhost'", { db: null });

// ------------------------------------------------------------ write mode
if (WRITE) {
  let src = fs.readFileSync(PACK_FILE, 'utf8');
  let replaced = 0;
  src = src.replace(/code: `([^`]*)`,(\s*)result: '((?:[^'\\]|\\.)*)'/g, (all, code, ws) => {
    if (!newResults.has(code) || newResults.get(code) === '') return all; // keep a stated header-only (no rows) result
    replaced++;
    const tsv = newResults.get(code);
    const lit = tsv.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\t/g, '\\t').replace(/\n/g, '\\n');
    return `code: \`${code}\`,${ws}result: '${lit}'`;
  });
  fs.writeFileSync(PACK_FILE, src);
  fs.writeFileSync(EXPECT_FILE, JSON.stringify(newExpect, null, 2) + '\n');
  console.log(`--write: refreshed ${replaced} lesson results, ${Object.keys(newExpect).length} question results, answers.sql expected rows`);
}

console.log(`\n${ran} statements/checks run, ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
