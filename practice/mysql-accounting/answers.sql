-- 会计人的 MySQL：各课动手任务的参考答案
-- 先导入 schema-and-data.sql，再在终端或 Sequel Ace 里逐条运行。
-- 每条查询上方的“预期结果”是在 MySQL 8.4 上真实运行得到的（列之间用 | 隔开）。
-- 你的写法可以和这里不同，只要结果一样就对。
-- 这个文件只查询、不修改数据（第 15 课的修改放在事务里，最后会回滚）。

USE acct_practice;

-- ==================================================================== 第 3 课
-- [3] 导入后检查：分录行数
-- 预期结果：
-- | 分录行数
-- | 325
SELECT COUNT(*) AS 分录行数 FROM voucher_lines;

-- ==================================================================== 第 4 课
-- [4-1] 所有供应商，按付款期从短到长（付款期相同的按编号）
-- 预期结果：
-- | vendor_id | vendor_name | payment_days
-- | S004 | 安居物业服务有限公司 | 15
-- | S001 | 明光纸业有限公司 | 30
-- | S003 | 优印办公设备有限公司 | 30
-- | S005 | 快运物流有限公司 | 30
-- | S002 | 恒达笔业有限公司 | 45
SELECT vendor_id, vendor_name, payment_days
FROM vendors
ORDER BY payment_days, vendor_id;

-- [4-2] 2026 年 3 月开出、价税合计 5 万元以上的应收发票
-- 预期结果：
-- | invoice_no | customer_id | invoice_date | total_amount
-- | XS-2603-001 | C002 | 2026-03-02 | 51980.00
-- | XS-2603-003 | C001 | 2026-03-09 | 66670.00
-- | XS-2603-004 | C004 | 2026-03-12 | 67800.00
-- | XS-2603-008 | C001 | 2026-03-26 | 59664.00
SELECT invoice_no, customer_id, invoice_date, total_amount
FROM ar_invoices
WHERE invoice_date >= '2026-03-01' AND invoice_date < '2026-04-01'
  AND total_amount >= 50000
ORDER BY invoice_date;

-- [4-3] 摘要里含“招待”的凭证
-- 预期结果：
-- | voucher_no | voucher_date | description
-- | 2026-01-014 | 2026-01-12 | 业务招待费
-- | 2026-02-017 | 2026-02-12 | 业务招待费
-- | 2026-03-018 | 2026-03-12 | 业务招待费
-- | 2026-03-036 | 2026-03-25 | 业务招待费
SELECT voucher_no, voucher_date, description
FROM vouchers
WHERE description LIKE '%招待%'
ORDER BY voucher_date, voucher_no;

-- ==================================================================== 第 5 课
-- [5-1] 按供应商汇总 2026 年收到的应付发票（注意 S002 含一张重复录入的发票，第 9 课会查）
-- 预期结果：
-- | vendor_id | 张数 | 价税合计
-- | S001 | 3 | 406800.00
-- | S002 | 4 | 282500.00
-- | S003 | 3 | 259900.00
-- | S004 | 3 | 36000.00
-- | S005 | 3 | 13080.00
SELECT vendor_id, COUNT(*) AS 张数, SUM(total_amount) AS 价税合计
FROM ap_invoices
WHERE invoice_date >= '2026-01-01'
GROUP BY vendor_id
ORDER BY vendor_id;

-- [5-2] 按部门统计带部门的分录行数
-- 预期结果：
-- | dept_id | 行数
-- | D01 | 19
-- | D02 | 17
-- | D03 | 13
-- | D04 | 11
SELECT dept_id, COUNT(*) AS 行数
FROM voucher_lines
WHERE dept_id IS NOT NULL
GROUP BY dept_id
ORDER BY dept_id;

-- [5-3] 2026 年收款 4 次以上的客户
-- 预期结果：
-- | customer_id | 收款次数
-- | C001 | 4
-- | C002 | 4
SELECT customer_id, COUNT(*) AS 收款次数
FROM ar_receipts
WHERE receipt_date >= '2026-01-01'
GROUP BY customer_id
HAVING COUNT(*) >= 4
ORDER BY customer_id;

-- ==================================================================== 第 6 课
-- [6-1] 按月统计 2026 年 1-3 月的凭证张数（按凭证日期；期初余额凭证日期是 2025-12-31，不在内）
-- 预期结果：
-- | 月份 | 张数
-- | 2026-01 | 38
-- | 2026-02 | 45
-- | 2026-03 | 48
SELECT DATE_FORMAT(voucher_date, '%Y-%m') AS 月份, COUNT(*) AS 张数
FROM vouchers
WHERE voucher_date >= '2026-01-01' AND voucher_date < '2026-04-01'
GROUP BY 月份
ORDER BY 月份;

-- [6-2] 凭证日期和录入日期不是同一天的凭证
-- 预期结果：
-- | voucher_no | voucher_date | created_at | description
-- | 2026-01-036 | 2026-01-31 | 2026-02-01 09:15:00 | 计提1月工资
SELECT voucher_no, voucher_date, created_at, description
FROM vouchers
WHERE DATE(created_at) <> voucher_date
ORDER BY voucher_no;

-- [6-3] 凭证日期是 3 月 31 日的凭证和它们的录入时间
-- 预期结果：
-- | voucher_no | description | created_at
-- | 2026-03-045 | 银行手续费 | 2026-03-31 09:16:00
-- | 2026-03-044 | 3月运费（快运物流有限公司发票 KY260331） | 2026-03-31 15:14:00
-- | 2026-03-046 | 计提3月工资 | 2026-03-31 17:30:00
-- | 2026-03-047 | 计提3月折旧 | 2026-03-31 17:40:00
-- | 2026-03-048 | 结转3月销售成本 | 2026-03-31 18:00:00
-- | 2026-03-043 | 销售给南山设计工作室，发票 XS-2603-010 | 2026-03-31 18:20:00
SELECT voucher_no, description, created_at
FROM vouchers
WHERE voucher_date = '2026-03-31'
ORDER BY created_at;

-- ==================================================================== 第 7 课
-- [7-1] 2026-02-025 号凭证的分录：科目名称，有供应商的显示供应商名称
-- 预期结果：
-- | line_no | account_name | vendor_name | debit | credit
-- | 1 | 库存商品 | NULL | 70000.00 | 0.00
-- | 2 | 应交税费 | NULL | 9100.00 | 0.00
-- | 3 | 应付账款 | 恒达笔业有限公司 | 0.00 | 79100.00
SELECT l.line_no, a.account_name, s.vendor_name, l.debit, l.credit
FROM voucher_lines l
JOIN vouchers v ON v.voucher_id = l.voucher_id
JOIN accounts a ON a.account_code = l.account_code
LEFT JOIN vendors s ON s.vendor_id = l.vendor_id
WHERE v.voucher_no = '2026-02-025'
ORDER BY l.line_no;

-- [7-2] 所有应收发票：发票号、客户名称、价税合计
-- 预期结果：
-- | invoice_no | customer_name | total_amount
-- | XS-2512-015 | 东湖教育培训中心 | 45200.00
-- | XS-2601-003 | 东湖教育培训中心 | 41810.00
-- | XS-2601-008 | 东湖教育培训中心 | 54240.00
-- | XS-2602-004 | 东湖教育培训中心 | 44748.00
-- | XS-2603-001 | 东湖教育培训中心 | 51980.00
-- | XS-2603-007 | 东湖教育培训中心 | 35256.00
-- | XS-2512-007 | 北辰科技有限公司 | 67800.00
-- | XS-2601-001 | 北辰科技有限公司 | 63280.00
-- | XS-2601-006 | 北辰科技有限公司 | 37968.00
-- | XS-2602-002 | 北辰科技有限公司 | 70060.00
-- | XS-2602-007 | 北辰科技有限公司 | 50850.00
-- | XS-2603-003 | 北辰科技有限公司 | 66670.00
-- | XS-2603-008 | 北辰科技有限公司 | 59664.00
-- | XS-2601-002 | 南山设计工作室 | 21696.00
-- | XS-2601-007 | 南山设计工作室 | 16950.00
-- | XS-2602-006 | 南山设计工作室 | 19888.00
-- | XS-2603-005 | 南山设计工作室 | 22374.00
-- | XS-2603-010 | 南山设计工作室 | 14690.00
-- | XS-2512-022 | 海棠酒店管理有限公司 | 33900.00
-- | XS-2601-005 | 海棠酒店管理有限公司 | 47460.00
-- | XS-2602-003 | 海棠酒店管理有限公司 | 25312.00
-- | XS-2602-009 | 海棠酒店管理有限公司 | 20340.00
-- | XS-2603-002 | 海棠酒店管理有限公司 | 39776.00
-- | XS-2603-009 | 海棠酒店管理有限公司 | 28928.00
-- | XS-2511-021 | 西岭连锁书店 | 90400.00
-- | XS-2601-009 | 西岭连锁书店 | 79100.00
-- | XS-2602-005 | 西岭连锁书店 | 58760.00
-- | XS-2603-004 | 西岭连锁书店 | 67800.00
-- | XS-2601-004 | 青松物业管理有限公司 | 27120.00
-- | XS-2602-001 | 青松物业管理有限公司 | 32770.00
-- | XS-2602-008 | 青松物业管理有限公司 | 22600.00
-- | XS-2603-006 | 青松物业管理有限公司 | 22600.00
SELECT i.invoice_no, c.customer_name, i.total_amount
FROM ar_invoices i
JOIN customers c ON c.customer_id = i.customer_id
ORDER BY c.customer_name, i.invoice_no;

-- [7-3] 每个科目的分录行数（只有 1221 是 0）
-- 预期结果：
-- | account_code | account_name | 分录行数
-- | 1001 | 库存现金 | 8
-- | 1002 | 银行存款 | 73
-- | 1122 | 应收账款 | 50
-- | 1221 | 其他应收款 | 0
-- | 1405 | 库存商品 | 14
-- | 1601 | 固定资产 | 1
-- | 1602 | 累计折旧 | 4
-- | 2202 | 应付账款 | 33
-- | 2211 | 应付职工薪酬 | 7
-- | 2221 | 应交税费 | 42
-- | 4001 | 实收资本 | 1
-- | 4104 | 利润分配 | 1
-- | 6001 | 主营业务收入 | 28
-- | 6401 | 主营业务成本 | 3
-- | 6601 | 销售费用 | 30
-- | 6602 | 管理费用 | 26
-- | 6603 | 财务费用 | 4
SELECT a.account_code, a.account_name, COUNT(l.line_id) AS 分录行数
FROM accounts a
LEFT JOIN voucher_lines l ON l.account_code = a.account_code
GROUP BY a.account_code, a.account_name
ORDER BY a.account_code;

-- ==================================================================== 第 8 课
-- [8-1] 借贷不平的凭证（埋好的问题：2026-03-016，贷方多记 180.00）
-- 预期结果：
-- | voucher_no | voucher_date | description | 借方合计 | 贷方合计 | 差额
-- | 2026-03-016 | 2026-03-11 | 购买打印纸、硒鼓 | 1350.00 | 1530.00 | -180.00
SELECT v.voucher_no, v.voucher_date, v.description,
       SUM(l.debit) AS 借方合计, SUM(l.credit) AS 贷方合计,
       SUM(l.debit) - SUM(l.credit) AS 差额
FROM vouchers v
JOIN voucher_lines l ON l.voucher_id = v.voucher_id
GROUP BY v.voucher_no, v.voucher_date, v.description
HAVING SUM(l.debit) <> SUM(l.credit);

-- [8-2] 2 月科目余额表（期初 = 2 月 1 日以前，本期 = 2 月）
-- 它的期末余额应和第 8 课正文里 3 月表的期初余额逐个科目一致。
-- 预期结果：
-- | 科目代码 | 科目名称 | 方向 | 期初余额 | 本期借方 | 本期贷方 | 期末余额
-- | 1001 | 库存现金 | 借 | 2539.70 | 2000.00 | 645.20 | 3894.50
-- | 1002 | 银行存款 | 借 | 352465.90 | 261028.00 | 390762.20 | 222731.70
-- | 1122 | 应收账款 | 借 | 492228.00 | 345328.00 | 261028.00 | 576528.00
-- | 1405 | 库存商品 | 借 | 179744.00 | 300000.00 | 220032.00 | 259712.00
-- | 1601 | 固定资产 | 借 | 120000.00 | 0.00 | 0.00 | 120000.00
-- | 1602 | 累计折旧 | 贷 | 38000.00 | 0.00 | 2000.00 | 40000.00
-- | 2202 | 应付账款 | 贷 | 298160.00 | 310160.00 | 354815.00 | 342815.00
-- | 2211 | 应付职工薪酬 | 贷 | 45600.00 | 45600.00 | 44500.00 | 44500.00
-- | 2221 | 应交税费 | 贷 | 11024.00 | 50024.00 | 39728.00 | 728.00
-- | 4001 | 实收资本 | 贷 | 500000.00 | 0.00 | 0.00 | 500000.00
-- | 4104 | 利润分配 | 贷 | 237900.00 | 0.00 | 0.00 | 237900.00
-- | 6001 | 主营业务收入 | 贷 | 344800.00 | 0.00 | 305600.00 | 650400.00
-- | 6401 | 主营业务成本 | 借 | 248256.00 | 220032.00 | 0.00 | 468288.00
-- | 6601 | 销售费用 | 借 | 41237.90 | 47873.50 | 0.00 | 89111.40
-- | 6602 | 管理费用 | 借 | 38926.00 | 36992.90 | 0.00 | 75918.90
-- | 6603 | 财务费用 | 借 | 86.50 | 72.00 | 0.00 | 158.50
SELECT a.account_code AS 科目代码, a.account_name AS 科目名称, a.balance_side AS 方向,
       SUM(CASE WHEN v.voucher_date < '2026-02-01' THEN l.debit - l.credit ELSE 0 END)
         * CASE WHEN a.balance_side = '借' THEN 1 ELSE -1 END AS 期初余额,
       SUM(CASE WHEN v.voucher_date >= '2026-02-01' THEN l.debit ELSE 0 END) AS 本期借方,
       SUM(CASE WHEN v.voucher_date >= '2026-02-01' THEN l.credit ELSE 0 END) AS 本期贷方,
       SUM(l.debit - l.credit)
         * CASE WHEN a.balance_side = '借' THEN 1 ELSE -1 END AS 期末余额
FROM accounts a
JOIN voucher_lines l ON l.account_code = a.account_code
JOIN vouchers v ON v.voucher_id = l.voucher_id
WHERE v.voucher_date < '2026-03-01'
GROUP BY a.account_code, a.account_name, a.balance_side
ORDER BY a.account_code;

-- [8-3] 试算平衡：包含全部凭证时差 -180.00；排除 2026-03-016 后差额为 0（借贷平衡）
-- 预期结果：
-- | 借方合计 | 贷方合计 | 差额
-- | 5749145.90 | 5749145.90 | 0.00
SELECT SUM(l.debit) AS 借方合计, SUM(l.credit) AS 贷方合计,
       SUM(l.debit) - SUM(l.credit) AS 差额
FROM voucher_lines l
JOIN vouchers v ON v.voucher_id = l.voucher_id
WHERE v.voucher_no <> '2026-03-016';

-- ==================================================================== 第 9 课
-- [9-1] 没付清的应付发票
-- 预期结果：
-- | vendor_name | invoice_no | invoice_date | 未付金额
-- | 恒达笔业有限公司 | 04418827 | 2026-02-16 | 79100.00
-- | 明光纸业有限公司 | 03318010 | 2026-03-04 | 158200.00
-- | 恒达笔业有限公司 | 04419502 | 2026-03-17 | 56500.00
-- | 优印办公设备有限公司 | 05520777 | 2026-03-25 | 101700.00
-- | 快运物流有限公司 | KY260331 | 2026-03-31 | 4905.00
SELECT s.vendor_name, i.invoice_no, i.invoice_date,
       i.total_amount - COALESCE(p.paid, 0) AS 未付金额
FROM ap_invoices i
JOIN vendors s ON s.vendor_id = i.vendor_id
LEFT JOIN (
  SELECT invoice_id, SUM(applied_amount) AS paid
  FROM ap_payment_applications
  GROUP BY invoice_id
) p ON p.invoice_id = i.invoice_id
WHERE i.total_amount - COALESCE(p.paid, 0) > 0
ORDER BY i.invoice_date, i.invoice_id;

-- [9-2] 应付账龄（截至 2026-03-31，按发票日期；正好 30 天算第一段；只算截止日及以前的发票和付款）
-- 预期结果：
-- | vendor_id | 账龄_0_30 | 账龄_31_60 | 账龄_61_90 | 账龄_90以上 | 合计
-- | S001 | 158200.00 | 0.00 | 0.00 | 0.00 | 158200.00
-- | S002 | 56500.00 | 79100.00 | 0.00 | 0.00 | 135600.00
-- | S003 | 101700.00 | 0.00 | 0.00 | 0.00 | 101700.00
-- | S005 | 4905.00 | 0.00 | 0.00 | 0.00 | 4905.00
SELECT i.vendor_id,
       SUM(CASE WHEN DATEDIFF('2026-03-31', i.invoice_date) <= 30
                THEN i.total_amount - COALESCE(p.paid, 0) ELSE 0 END) AS 账龄_0_30,
       SUM(CASE WHEN DATEDIFF('2026-03-31', i.invoice_date) BETWEEN 31 AND 60
                THEN i.total_amount - COALESCE(p.paid, 0) ELSE 0 END) AS 账龄_31_60,
       SUM(CASE WHEN DATEDIFF('2026-03-31', i.invoice_date) BETWEEN 61 AND 90
                THEN i.total_amount - COALESCE(p.paid, 0) ELSE 0 END) AS 账龄_61_90,
       SUM(CASE WHEN DATEDIFF('2026-03-31', i.invoice_date) > 90
                THEN i.total_amount - COALESCE(p.paid, 0) ELSE 0 END) AS 账龄_90以上,
       SUM(i.total_amount - COALESCE(p.paid, 0)) AS 合计
FROM ap_invoices i
LEFT JOIN (
  SELECT a.invoice_id, SUM(a.applied_amount) AS paid
  FROM ap_payment_applications a
  JOIN ap_payments y ON y.payment_id = a.payment_id
  WHERE y.payment_date <= '2026-03-31'
  GROUP BY a.invoice_id
) p ON p.invoice_id = i.invoice_id
WHERE i.invoice_date <= '2026-03-31'
GROUP BY i.vendor_id
HAVING SUM(i.total_amount - COALESCE(p.paid, 0)) > 0
ORDER BY i.vendor_id;

-- [9-3] 应付勾稽：未付发票合计 = 总账 2202 应付账款贷方余额，差额为 0
-- 预期结果：
-- | 未付发票合计 | 总账应付余额
-- | 400405.00 | 400405.00
SELECT (SELECT SUM(i.total_amount - COALESCE(p.paid, 0))
        FROM ap_invoices i
        LEFT JOIN (SELECT invoice_id, SUM(applied_amount) AS paid
                   FROM ap_payment_applications GROUP BY invoice_id) p
          ON p.invoice_id = i.invoice_id) AS 未付发票合计,
       (SELECT SUM(credit - debit) FROM voucher_lines WHERE account_code = '2202') AS 总账应付余额;

-- [9-4] 重复录入的应付发票（埋好的问题），以及两条记录分别对应的凭证
-- 处理建议：核实原始发票只有一张后，冲销 2 月 18 日多录的那张凭证（2026-02-025），并删除对应的发票记录；
-- 3 月 30 日已经付过一次，不能再付。
-- 预期结果：
-- | vendor_id | invoice_no | 录入次数 | 合计金额
-- | S002 | 04418827 | 2 | 158200.00
SELECT vendor_id, invoice_no, COUNT(*) AS 录入次数, SUM(total_amount) AS 合计金额
FROM ap_invoices
GROUP BY vendor_id, invoice_no
HAVING COUNT(*) > 1;

-- 预期结果：
-- | invoice_id | invoice_no | invoice_date | total_amount | voucher_no | voucher_date
-- | 11 | 04418827 | 2026-02-16 | 79100.00 | 2026-02-022 | 2026-02-16
-- | 12 | 04418827 | 2026-02-16 | 79100.00 | 2026-02-025 | 2026-02-18
SELECT i.invoice_id, i.invoice_no, i.invoice_date, i.total_amount, v.voucher_no, v.voucher_date
FROM ap_invoices i
JOIN vouchers v ON v.voucher_id = i.voucher_id
WHERE i.vendor_id = 'S002' AND i.invoice_no = '04418827'
ORDER BY i.invoice_id;

-- ==================================================================== 第 10 课
-- [10-1] 按部门汇总 1-3 月三项期间费用
-- 预期结果：
-- | 部门 | 期间费用合计
-- | 销售部 | 92424.10
-- | 管理部 | 90415.00
-- | 仓储物流部 | 43297.30
-- | 财务部 | 23753.70
SELECT d.dept_name AS 部门, SUM(l.debit - l.credit) AS 期间费用合计
FROM voucher_lines l
JOIN vouchers v ON v.voucher_id = l.voucher_id
JOIN departments d ON d.dept_id = l.dept_id
WHERE l.account_code IN ('6601', '6602', '6603')
  AND v.voucher_date >= '2026-01-01' AND v.voucher_date < '2026-04-01'
GROUP BY d.dept_id, d.dept_name
ORDER BY 期间费用合计 DESC;

-- [10-2] 1-3 月累计预算对比（先把预算和实际各自汇总到“部门 + 科目”，再连接）
-- 预期结果：
-- | 部门 | 科目 | 预算 | 实际 | 差异 | 标记
-- | D01 | 6602 | 91600.00 | 90415.00 | -1185.00 | 未超
-- | D02 | 6601 | 88400.00 | 92424.10 | 4024.10 | 超支
-- | D03 | 6601 | 43900.00 | 43297.30 | -602.70 | 未超
-- | D03 | 6602 | 1500.00 | 0.00 | -1500.00 | 未超
-- | D04 | 6602 | 30000.00 | 23812.10 | -6187.90 | 未超
-- | D04 | 6603 | 300.00 | -58.40 | -358.40 | 未超
SELECT b.dept_id AS 部门, b.account_code AS 科目, b.budget AS 预算,
       COALESCE(x.actual, 0) AS 实际,
       COALESCE(x.actual, 0) - b.budget AS 差异,
       CASE WHEN COALESCE(x.actual, 0) > b.budget THEN '超支' ELSE '未超' END AS 标记
FROM (
  SELECT dept_id, account_code, SUM(amount) AS budget
  FROM budgets
  WHERE budget_month BETWEEN '2026-01' AND '2026-03'
  GROUP BY dept_id, account_code
) b
LEFT JOIN (
  SELECT l.dept_id, l.account_code, SUM(l.debit - l.credit) AS actual
  FROM voucher_lines l
  JOIN vouchers v ON v.voucher_id = l.voucher_id
  WHERE l.account_code IN ('6601', '6602', '6603')
    AND v.voucher_date >= '2026-01-01' AND v.voucher_date < '2026-04-01'
  GROUP BY l.dept_id, l.account_code
) x ON x.dept_id = b.dept_id AND x.account_code = b.account_code
ORDER BY b.dept_id, b.account_code;

-- [10-3] 3 月金额最大的 5 笔费用分录
-- 预期结果：
-- | voucher_no | description | dept_id | account_code | debit
-- | 2026-03-046 | 计提3月工资 | D02 | 6601 | 19200.00
-- | 2026-03-001 | 3月办公室租金（安居物业服务有限公司发票 00872465） | D01 | 6602 | 12000.00
-- | 2026-03-046 | 计提3月工资 | D01 | 6602 | 12000.00
-- | 2026-03-046 | 计提3月工资 | D03 | 6601 | 8000.00
-- | 2026-03-046 | 计提3月工资 | D04 | 6602 | 7000.00
SELECT v.voucher_no, v.description, l.dept_id, l.account_code, l.debit
FROM voucher_lines l
JOIN vouchers v ON v.voucher_id = l.voucher_id
WHERE l.account_code IN ('6601', '6602', '6603')
  AND v.voucher_date >= '2026-03-01' AND v.voucher_date < '2026-04-01'
ORDER BY l.debit DESC, v.voucher_no, l.line_id
LIMIT 5;

-- ==================================================================== 第 11 课
-- [11-1] 2026 年 1 月利润表：各损益科目发生额
-- 预期结果：
-- | 科目代码 | 项目 | 本月发生额
-- | 6001 | 主营业务收入 | 344800.00
-- | 6401 | 主营业务成本 | 248256.00
-- | 6601 | 销售费用 | 41237.90
-- | 6602 | 管理费用 | 38926.00
-- | 6603 | 财务费用 | 86.50
SELECT a.account_code AS 科目代码, a.account_name AS 项目,
       SUM(CASE WHEN a.balance_side = '贷' THEN l.credit - l.debit
                ELSE l.debit - l.credit END) AS 本月发生额
FROM voucher_lines l
JOIN vouchers v ON v.voucher_id = l.voucher_id
JOIN accounts a ON a.account_code = l.account_code
WHERE a.category = '损益'
  AND v.voucher_date >= '2026-01-01' AND v.voucher_date < '2026-02-01'
GROUP BY a.account_code, a.account_name
ORDER BY a.account_code;

-- [11-1] 2026 年 1 月利润总额
-- 预期结果：
-- | 利润总额
-- | 16293.60
SELECT SUM(l.credit - l.debit) AS 利润总额
FROM voucher_lines l
JOIN vouchers v ON v.voucher_id = l.voucher_id
JOIN accounts a ON a.account_code = l.account_code
WHERE a.category = '损益'
  AND v.voucher_date >= '2026-01-01' AND v.voucher_date < '2026-02-01';

-- [11-2] 2026-02-28 的资产、负债、所有者权益和 1-2 月利润；2 月末没有不平的凭证，差额为 0
-- 预期结果：
-- | 资产 | 负债 | 所有者权益 | 本期利润 | 差额
-- | 1142866.20 | 388043.00 | 737900.00 | 16923.20 | 0.00
SELECT SUM(CASE WHEN a.category = '资产' THEN l.debit - l.credit ELSE 0 END) AS 资产,
       SUM(CASE WHEN a.category = '负债' THEN l.credit - l.debit ELSE 0 END) AS 负债,
       SUM(CASE WHEN a.category = '所有者权益' THEN l.credit - l.debit ELSE 0 END) AS 所有者权益,
       SUM(CASE WHEN a.category = '损益' THEN l.credit - l.debit ELSE 0 END) AS 本期利润,
       SUM(l.debit - l.credit) AS 差额
FROM voucher_lines l
JOIN vouchers v ON v.voucher_id = l.voucher_id
JOIN accounts a ON a.account_code = l.account_code
WHERE v.voucher_date <= '2026-02-28';

-- [11-3] 2026-03-31 固定资产净值 = 固定资产原值 - 累计折旧
-- 预期结果：
-- | 固定资产净值
-- | 78000.00
SELECT SUM(debit - credit) AS 固定资产净值
FROM voucher_lines
WHERE account_code IN ('1601', '1602');

-- ==================================================================== 第 12 课
-- [12-1] WITH 查询的第一步单独运行：每张发票核销了多少
-- 预期结果：
-- | invoice_id | applied
-- | 1 | 40000.00
-- | 2 | 67800.00
-- | 3 | 45200.00
-- | 4 | 33900.00
-- | 5 | 63280.00
-- | 6 | 21696.00
-- | 7 | 41810.00
-- | 8 | 27120.00
-- | 9 | 27460.00
-- | 10 | 37968.00
-- | 11 | 16950.00
-- | 12 | 54240.00
-- | 14 | 32770.00
-- | 15 | 70060.00
-- | 16 | 25312.00
-- | 17 | 20000.00
-- | 19 | 19888.00
-- | 20 | 50850.00
SELECT invoice_id, SUM(applied_amount) AS applied
FROM ar_receipt_applications
GROUP BY invoice_id
ORDER BY invoice_id;

-- [12-1] 第二步：每张发票还欠多少（这里只看 C004，行数少一些）
-- 预期结果：
-- | invoice_no | customer_id | open_amount
-- | XS-2511-021 | C004 | 50400.00
-- | XS-2601-009 | C004 | 79100.00
-- | XS-2602-005 | C004 | 58760.00
-- | XS-2603-004 | C004 | 67800.00
WITH applied AS (
  SELECT invoice_id, SUM(applied_amount) AS applied
  FROM ar_receipt_applications
  GROUP BY invoice_id
)
SELECT i.invoice_no, i.customer_id, i.total_amount - COALESCE(a.applied, 0) AS open_amount
FROM ar_invoices i
LEFT JOIN applied a ON a.invoice_id = i.invoice_id
WHERE i.customer_id = 'C004'
ORDER BY i.invoice_no;

-- [12-2] 按供应商给 2026 年采购额（不含税）排名
-- 预期结果：
-- | vendor_id | 不含税金额 | 名次
-- | S001 | 360000.00 | 1
-- | S002 | 250000.00 | 2
-- | S003 | 230000.00 | 3
-- | S004 | 36000.00 | 4
-- | S005 | 13080.00 | 5
SELECT vendor_id,
       SUM(net_amount) AS 不含税金额,
       RANK() OVER (ORDER BY SUM(net_amount) DESC) AS 名次
FROM ap_invoices
WHERE invoice_date >= '2026-01-01'
GROUP BY vendor_id
ORDER BY 名次;

-- [12-3] 库存现金按月的累计余额
-- 预期结果：
-- | 月份 | 本月净额 | 累计余额
-- | 2025-12 | 3200.00 | 3200.00
-- | 2026-01 | -660.30 | 2539.70
-- | 2026-02 | 1354.80 | 3894.50
-- | 2026-03 | -580.60 | 3313.90
SELECT 月份, 本月净额,
       SUM(本月净额) OVER (ORDER BY 月份) AS 累计余额
FROM (
  SELECT DATE_FORMAT(v.voucher_date, '%Y-%m') AS 月份,
         SUM(l.debit - l.credit) AS 本月净额
  FROM voucher_lines l
  JOIN vouchers v ON v.voucher_id = l.voucher_id
  WHERE l.account_code = '1001'
  GROUP BY 月份
) m
ORDER BY 月份;

-- ==================================================================== 第 13 课
-- [13-1] 应付三张表的列说明（复制给 AI 用）
-- 预期结果：
-- | 表名 | 列名 | 类型 | 说明
-- | ap_invoices | invoice_id | int | 应付发票内部编号
-- | ap_invoices | invoice_no | varchar | 供应商开来的发票号
-- | ap_invoices | vendor_id | varchar | 供应商
-- | ap_invoices | invoice_date | date | 发票日期
-- | ap_invoices | due_date | date | 到期日 = 发票日期 + 付款期
-- | ap_invoices | net_amount | decimal | 不含税金额（普通发票为全额）
-- | ap_invoices | tax_amount | decimal | 可抵扣进项税额
-- | ap_invoices | total_amount | decimal | 价税合计（应付金额）
-- | ap_invoices | voucher_id | int | 记账凭证
-- | ap_payment_applications | payment_id | int | 哪笔付款
-- | ap_payment_applications | invoice_id | int | 核销到哪张应付发票
-- | ap_payment_applications | applied_amount | decimal | 核销金额
-- | ap_payments | payment_id | int | 付款内部编号
-- | ap_payments | payment_no | varchar | 付款单号
-- | ap_payments | vendor_id | varchar | 收款供应商
-- | ap_payments | payment_date | date | 付款日期
-- | ap_payments | amount | decimal | 付款金额
-- | ap_payments | voucher_id | int | 记账凭证
SELECT table_name AS 表名, column_name AS 列名, data_type AS 类型, column_comment AS 说明
FROM information_schema.columns
WHERE table_schema = 'acct_practice'
  AND table_name IN ('ap_invoices', 'ap_payments', 'ap_payment_applications')
ORDER BY table_name, ordinal_position;

-- [13-2] AI 应该写出的应付账龄，和第 9 课 [9-2] 的结果一致即可。
-- [13-3] 手工验算一个供应商：快运物流（S005）发票合计 - 付款合计 = 4,905.00（3 月运费未付）
-- 预期结果：
-- | 发票合计 | 付款合计
-- | 13080.00 | 8175.00
SELECT (SELECT SUM(total_amount) FROM ap_invoices WHERE vendor_id = 'S005') AS 发票合计,
       (SELECT SUM(amount) FROM ap_payments WHERE vendor_id = 'S005') AS 付款合计;

-- ==================================================================== 第 14 课
-- [14-1] 没有核销的收款（埋好的问题）
-- 预期结果：
-- | receipt_no | customer_id | receipt_date | amount
-- | SK-2603-008 | C005 | 2026-03-27 | 22600.00
SELECT r.receipt_no, r.customer_id, r.receipt_date, r.amount
FROM ar_receipts r
LEFT JOIN ar_receipt_applications a ON a.receipt_id = r.receipt_id
WHERE a.receipt_id IS NULL;

-- [14-1] 应收勾稽：账龄合计（未收发票） - 未核销收款 = 总账 1122 应收账款余额
-- 即 685,686.00 - 22,600.00 = 663,086.00，差额 0.00
-- 预期结果：
-- | 未收发票合计 | 未核销收款 | 总账应收余额 | 差额
-- | 685686.00 | 22600.00 | 663086.00 | 0.00
SELECT x.未收发票合计, y.未核销收款, z.总账应收余额,
       x.未收发票合计 - y.未核销收款 - z.总账应收余额 AS 差额
FROM (
  SELECT SUM(i.total_amount - COALESCE(p.applied, 0)) AS 未收发票合计
  FROM ar_invoices i
  LEFT JOIN (SELECT invoice_id, SUM(applied_amount) AS applied
             FROM ar_receipt_applications GROUP BY invoice_id) p
    ON p.invoice_id = i.invoice_id
) x
CROSS JOIN (
  SELECT SUM(r.amount - COALESCE(a.applied, 0)) AS 未核销收款
  FROM ar_receipts r
  LEFT JOIN (SELECT receipt_id, SUM(applied_amount) AS applied
             FROM ar_receipt_applications GROUP BY receipt_id) a
    ON a.receipt_id = r.receipt_id
) y
CROSS JOIN (
  SELECT SUM(debit - credit) AS 总账应收余额
  FROM voucher_lines
  WHERE account_code = '1122'
) z;

-- [14-2] 错误写法：连接核销表后对收款金额求和（C001 多算 120,910.00，C005 少了 22,600.00）
-- 预期结果：
-- | customer_id | 收款合计
-- | C001 | 410868.00
-- | C002 | 161250.00
-- | C003 | 58534.00
-- | C004 | 40000.00
-- | C005 | 59890.00
-- | C006 | 86672.00
SELECT r.customer_id, SUM(r.amount) AS 收款合计
FROM ar_receipts r
JOIN ar_receipt_applications a ON a.receipt_id = r.receipt_id
GROUP BY r.customer_id
ORDER BY r.customer_id;

-- [14-2] 正确写法：直接在收款表上求和
-- 预期结果：
-- | customer_id | 收款合计
-- | C001 | 289958.00
-- | C002 | 161250.00
-- | C003 | 58534.00
-- | C004 | 40000.00
-- | C005 | 82490.00
-- | C006 | 86672.00
SELECT customer_id, SUM(amount) AS 收款合计
FROM ar_receipts
GROUP BY customer_id
ORDER BY customer_id;

-- [14-3] 不属于销售部的分录行数：要把没有部门（NULL）的行也算进去
-- 预期结果：
-- | 行数
-- | 308
SELECT COUNT(*) AS 行数
FROM voucher_lines
WHERE dept_id <> 'D02' OR dept_id IS NULL;

-- ==================================================================== 第 15 课
-- [15-1] 创建只读账号（密码换成你自己的），并确认它只有 SELECT 权限
CREATE USER IF NOT EXISTS 'acct_reader'@'localhost' IDENTIFIED BY 'Change-Me-2026';
GRANT SELECT ON acct_practice.* TO 'acct_reader'@'localhost';

-- 预期结果：
-- | Grants for acct_reader@localhost
-- | GRANT USAGE ON *.* TO `acct_reader`@`localhost`
-- | GRANT SELECT ON `acct_practice`.* TO `acct_reader`@`localhost`
SHOW GRANTS FOR 'acct_reader'@'localhost';

-- [15-2] 用 acct_reader 登录后运行任何 UPDATE 都会被拒绝，错误信息类似：
--   ERROR 1142 (42000): UPDATE command denied to user 'acct_reader'@'localhost' for table 'voucher_lines'
-- 这一步要换账号登录，不在本文件里运行。

-- [15-3] 用事务试一次修改，再回滚。中间的 SELECT 显示差额 0.00
START TRANSACTION;
UPDATE voucher_lines SET credit = 1350.00
WHERE voucher_id = (SELECT voucher_id FROM vouchers WHERE voucher_no = '2026-03-016')
  AND account_code = '1002';
-- 预期结果：
-- | 试算差额
-- | 0.00
SELECT SUM(debit) - SUM(credit) AS 试算差额 FROM voucher_lines;
ROLLBACK;

-- 回滚以后，差额回到 -180.00
-- 预期结果：
-- | 试算差额
-- | -180.00
SELECT SUM(debit) - SUM(credit) AS 试算差额 FROM voucher_lines;
