# 练习数据：会计人的 MySQL

这是网站课程「会计人的 MySQL」配套的练习账套。公司、客户、供应商和所有数字都是虚构的。

| 文件 | 用途 |
| --- | --- |
| `schema-and-data.sql` | 建立数据库 `acct_practice`（13 张表）并写入 2026 年 1–3 月的账。可以反复导入，每次结果完全一样。 |
| `answers.sql` | 各课动手任务的参考答案，每条查询上方写着真实运行得到的预期结果。 |
| `README.md` | 本说明。 |

> 注意：`schema-and-data.sql` 的第一句是 `DROP DATABASE IF EXISTS acct_practice;`，会先删掉同名的数据库再重建。只在你自己的练习服务器上导入，不要在公司的数据库上运行。

---

## 一、安装 MySQL

先点屏幕左上角苹果菜单 →“关于本机”，看 macOS 版本。

- **macOS 15 或更新**：先安装 Homebrew（官网 brew.sh 首页有安装命令），然后在“终端”里运行：
  ```shell
  brew install mysql
  brew services start mysql
  mysql -u root -e "SELECT VERSION();"
  ```
  能显示版本号就装好了。Homebrew 装的 MySQL 用 3306 端口，root（管理员账号）默认没有密码，只允许本机连接，会随开机启动；不想要时运行 `brew services stop mysql`。
- **macOS 14 或更早**：Homebrew 在这些系统上会改成从源代码编译，常因为 “Command Line Tools 太旧” 而失败。改用官网安装包：在 MySQL 官网（dev.mysql.com）下载页进入 Archives（历史版本），选 MySQL Community Server 8.4.3、你的 macOS 版本和芯片（Apple 芯片选 ARM），下载 `.dmg`，双击安装，按提示给 root 设一个密码并记好。
  - 安装包会把 MySQL 放在 `/usr/local/mysql`，但终端不知道去那里找，直接输入 `mysql` 会提示 `command not found`（找不到命令）。每次写完整路径 `/usr/local/mysql/bin/mysql` 就行；或者运行下面这行，把这个文件夹加进终端的查找范围（PATH），然后关掉终端重新打开：
    ```shell
    echo 'export PATH="/usr/local/mysql/bin:$PATH"' >> ~/.zshrc
    ```
  - 启动和停止：在“系统设置”最下面的 MySQL 面板里操作。
- **以前装过 MySQL 的**：旧的服务器可能还在后台运行，占着 3306 端口，新服务器就启动不了；或者你连上的其实是旧服务器，要用旧密码。先在“系统设置”最下面看有没有 MySQL 图标，有的话可以在那里停掉旧服务器。也可以让新服务器换一个端口（比如 3307），这时所有命令都要加 `-P 3307`，Sequel Ace 里也填 3307。拿不准就请懂的同事帮忙。
- **装不上**：课程网页上每段代码都附了真实运行结果，`answers.sql` 里有每个任务的预期结果，可以先对照着学。

## 二、图形界面工具：Sequel Ace

免费、开源、只做 MySQL，界面简单，要求 macOS 13 或更新。

- 安装：Mac App Store 搜索 “Sequel Ace”；或者 `brew install --cask sequel-ace`
- 连接：选 **Standard**，Host `127.0.0.1`，Username `root`，Password 按你的安装填写（Homebrew 默认留空），Port `3306`（换过端口的填你的端口），点 Connect。
- 连上后在左上角选数据库 `acct_practice`，点顶部 **Query**，输入 SQL 后点运行按钮。

## 三、导入练习数据

在终端输入 `cd ` 加一个空格，把这个文件夹拖进终端窗口，回车，然后：

```shell
# Homebrew 安装的 MySQL（root 无密码）
mysql -u root < schema-and-data.sql

# 官网安装包（root 有密码；回车后输入密码）
/usr/local/mysql/bin/mysql -u root -p < schema-and-data.sql
```

服务器不在默认的 3306 端口时，再加上 `-P 端口号`。导入成功后检查一下，应该是 325：

```sql
SELECT COUNT(*) AS 分录行数 FROM voucher_lines;
```

## 四、运行一条查询

打开命令行客户端（`mysql -u root`，官网安装包用 `/usr/local/mysql/bin/mysql -u root -p`），先选数据库，再输入查询，以分号结尾，回车运行：

```sql
USE acct_practice;
SELECT account_code, account_name, category, balance_side FROM accounts ORDER BY account_code;
```

退出命令行客户端输入 `exit`。

## 五、重置、加密码、只读账号

- **重置**：练习时把数据改乱了，重新导入一次 `schema-and-data.sql`（第三节），就回到初始状态。
- **给 root 加密码**（Homebrew 安装的 root 默认没有密码）：运行 `mysqladmin -u root password`，按提示输入两次新密码。之后命令里都要加 `-p`，Sequel Ace 里也要填密码。
- **只读账号**：第 15 课会建一个只能查询的账号 `acct_reader`。不需要时用 root 运行 `DROP USER 'acct_reader'@'localhost';` 删除。

## 六、数据说明

- 虚构公司：晴川文具贸易有限公司，办公文具批发。期间 2026-01-01 至 2026-03-31，人民币，增值税 13%（统一记在 2221 应交税费）。
- 期初余额：凭证 `2025-12-000`，日期 2025-12-31。所有 “2026 年” 的筛选都会自然排除它。
- 损益类科目季度内不结转（表结法），利润 = 损益类科目发生额；没有计提所得税。
- 主要表：`accounts` 科目、`vouchers` 凭证头、`voucher_lines` 凭证分录、`customers` 客户、`vendors` 供应商、`departments` 部门、`ar_invoices` / `ar_receipts` / `ar_receipt_applications` 应收发票、收款、核销，`ap_invoices` / `ap_payments` / `ap_payment_applications` 应付发票、付款、核销，`budgets` 月度费用预算。
- 132 张凭证、325 行分录、32 张应收发票、19 张应付发票。

### 埋好的问题（剧透，做完第 8、9、14 课再看）

1. 一张借贷不平的凭证：`2026-03-016`，借方 1,350.00，贷方 1,530.00（数字写颠倒）。排除它以后试算平衡。
2. 一张重复录入的应付发票：恒达笔业（S002）发票号 04418827，2 月 16 日和 2 月 18 日各记了一次账（库存、进项税和应付账款都多记了一份）。
3. 一笔未核销的收款：青松物业（C005）2026-03-27 付款 22,600.00，记了账但没有核销到发票。所以 **应收账龄合计 685,686.00 − 未核销收款 22,600.00 = 总账 1122 应收账款 663,086.00**。

## 七、给维护者

- 数据由 `web/tools/build-practice-data.mjs` 生成（固定随机种子，生成时会检查借贷平衡、往来勾稽等规则）。改数据请改生成脚本，再重新生成。
- `web/tools/check-course-sql.mjs` 会在真实 MySQL 上导入两次数据、运行课程和 `answers.sql` 里的每一条 SQL 并核对结果。在 `web/` 目录下运行（`MYSQL` 是 mysql 程序的路径，`MYSQL_ARGS` 是连接参数，账号要能建库、建用户）：
  ```shell
  MYSQL=/path/to/mysql MYSQL_ARGS="-u root -P 3306" node tools/check-course-sql.mjs
  ```
