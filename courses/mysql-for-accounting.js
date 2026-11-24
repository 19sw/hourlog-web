// Course pack: 会计人的 MySQL (zh-Hans). Schema: see README.md in this folder.
// Practice data: ../practice/mysql-accounting/ (fictional company, Q1 2026).
// Every SQL block here is run against that data on real MySQL by
// tools/check-course-sql.mjs; a block's `result` is the exact output MySQL
// returns (tab-separated, header first). Do not edit results by hand: change
// the SQL, then run the checker with --write and re-read the prose around it.

export default {
  schema: 1,
  id: 'mysql-for-accounting',
  type: 'topic',
  lang: 'zh-Hans',
  title: '会计人的 MySQL',
  summary: '写给零基础会计的数据库入门：看懂 SQL，自己写简单到中等的查询，学会让 AI 写 SQL 并检查它对不对。配一套可以在 Mac 上真实运行的练习账套。',

  levels: [
    { id: 1, label: '看得懂', desc: '知道数据库、表、凭证分录在数据库里的样子，能读懂常见的查询在查什么。' },
    { id: 2, label: '能自己写简单查询', desc: '能在练习库里自己写查询：筛选、汇总、连表，做借贷平衡检查、账龄、费用对比和报表取数。' },
    { id: 3, label: '能指挥 AI 并把关', desc: '能读懂复杂查询，向 AI 说清表结构和口径，并用勾稽和抽查判断 AI 的结果对不对。' },
  ],

  dimensions: [
    { id: 'concept', label: '概念理解' },
    { id: 'read', label: '读懂 SQL' },
    { id: 'apply', label: '会计应用' },
    { id: 'ai', label: 'AI 协作' },
  ],

  stages: [
    { id: 'basics', title: '认识数据库', summary: '用 Excel 和凭证来理解数据库，装好 MySQL 和练习数据。' },
    { id: 'query', title: '查询基础', summary: '筛选、排序、汇总、日期和连表，这是所有查询的地基。' },
    { id: 'accounting', title: '会计场景', summary: '借贷平衡、科目余额表、账龄和往来对账、费用对比预算、报表取数。' },
    { id: 'ai', title: '和 AI 协作', summary: '读懂复杂 SQL，向 AI 提需求，检查结果，守住数据安全。' },
  ],

  nodes: [
    // ------------------------------------------------------------ stage 1
    {
      id: 'db-basics',
      stage: 'basics',
      title: '数据库和表是什么',
      summary: '用你熟悉的 Excel 来理解数据库、表、行、列和主键。',
      level: 1,
      dimensions: ['concept'],
      prereqs: [],
      lesson: {
        sections: [
          {
            heading: '数据库就像一个管得很严的 Excel 工作簿',
            body: [
              '数据库（database）是专门用来存放和查找数据的“仓库”。可以先把它想成一个 Excel 工作簿：一个工作簿里有好几张工作表，一个数据库里也有好几张表（table）。',
              'MySQL 是最常见的数据库软件之一，免费、用的人多。本课程用它来练习。学到的思路换到别的数据库（比如 SQL Server、Oracle，或者公司财务软件背后的数据库）也基本通用。',
            ],
          },
          {
            heading: '表、行、列',
            body: [
              '一张表就像一张工作表：每一列（column，也叫字段）是一种信息，比如“客户编号”“客户名称”“信用期”；每一行（row，也叫记录）是一条完整的数据，比如一个客户。',
              '和 Excel 不同，表的每一列事先规定好了能放什么：金额列只能放数字，日期列只能放日期，你不能在金额列里写“待定”。这样麻烦一点，但数据更干净，汇总时不会因为某个格子写了文字而算错。',
              'Excel 用 A、B、C 来叫列，数据库里每一列都有名字。本课程的表名和列名是英文（比如 customers 表、customer_name 列），第一次出现时都会给出中文意思。',
            ],
          },
          {
            heading: '主键：每一行都有一个不会重复的编号',
            body: [
              '会计最熟悉的例子是凭证号：同一个账套里不会有两张凭证用同一个号。数据库里起这种作用的列叫主键（primary key），它保证每一行都能被准确地找到。',
              '下面是你的第一条 SQL。SQL 是向数据库提问的语言，读作“S-Q-L”。这条的意思是“把 departments（部门）表的所有行、所有列都拿出来”。现在不用会写，先看看结果长什么样：',
              { code: `SELECT * FROM departments;`,
                result: 'dept_id\tdept_name\nD01\t管理部\nD02\t销售部\nD03\t仓储物流部\nD04\t财务部' },
              '结果就是一张小表。dept_id（部门编号）是这张表的主键，每个部门一个，不会重复；dept_name 是部门名称。',
            ],
          },
          {
            heading: '数据库能帮会计做什么',
            body: [
              'Excel 适合几千、几万行的数据，再多就会变慢，多人同时改也容易乱。公司的业务系统和财务软件背后几乎都是数据库，几十万行凭证分录也能几秒钟汇总出来。',
              '会写一点 SQL，你就能自己从数据库里取数、核对，不用每次都等 IT 导出 Excel。就算让 AI 来写 SQL，你也要看得懂，才能判断它取的数对不对。',
            ],
          },
        ],
        askQuestions: [
          '数据库和 Excel 各自适合做什么？什么情况下应该从 Excel 换成数据库？',
          '主键和 Excel 里的“序号”列有什么区别？为什么删掉一行以后，主键一般不重新编号？',
          '一般公司的财务软件背后用的是什么数据库？财务人员通常能不能直接查？',
        ],
        task: {
          prompt: '找一张你工作中常用的 Excel 表（比如应收台账或费用明细），用数据库的眼光重新看它。',
          criteria: [
            '说出这张表的“一行”代表什么（例如一张发票、一笔费用）',
            '列出至少 5 列，并写出每列应该放什么类型的数据（文字、数字、日期）',
            '找出哪一列可以当主键；如果没有，想一想该加什么编号',
            '找出至少一个“不干净”的格子，比如金额列里写了文字，或者日期写法不统一',
          ],
        },
        reflection: {
          question: '为什么数据库要求每一列事先规定好数据类型，而 Excel 不要求？这对会计数据有什么好处？',
          answer: '因为数据库要保证每一行都能被机器准确地计算和查找。金额列只允许数字，汇总时就不会因为某个格子写了“待定”或“1,000元”而算错、漏算；日期列只允许日期，按月筛选时就不会漏掉写成“3月5号”的那一行。对会计来说，这相当于在录入时就把好关，后面的汇总和对账才靠得住。',
        },
        quiz: [
          {
            id: 'db-basics-q1',
            prompt: '把数据库和 Excel 对照，下面哪种对应关系最准确？',
            options: ['数据库 ≈ 一个单元格，表 ≈ 一列，行 ≈ 一个字符', '数据库 ≈ 一张工作表，表 ≈ 一行，行 ≈ 一个单元格', '数据库 ≈ 工作簿，表 ≈ 工作表，行 ≈ 一条记录', '数据库 ≈ 一个公式，表 ≈ 一个图表'],
            answer: 2,
            explanation: '一个数据库里有多张表，就像一个工作簿里有多张工作表；表里每一行是一条完整的记录，每一列是一种信息。',
          },
          {
            id: 'db-basics-q2',
            prompt: '假设凭证表用“凭证号”做主键。下面哪种情况数据库会拒绝？',
            options: ['两张凭证的凭证号相同', '两张凭证的摘要完全相同', '两张凭证日期相同'],
            answer: 0,
            explanation: '主键要求每一行的值都不重复。摘要、日期可以相同，凭证号作为主键不能重复。',
          },
          {
            id: 'db-basics-q3',
            prompt: '下面这条 SQL 做了什么？',
            code: `SELECT * FROM departments;`,
            options: ['删除 departments 表里的所有数据', '只返回第一行，也就是 D01 那个部门', '只返回 dept_name 这一列的所有部门名称', '返回 departments 的所有行和所有列'],
            answer: 3,
            explanation: '* 表示所有列；没有写筛选条件，所以返回所有行。SELECT 只读不改，不会删除任何东西。',
          },
        ],
      },
    },
    {
      id: 'acct-tables',
      stage: 'basics',
      title: '会计数据在数据库里长什么样',
      summary: '认识练习库里的科目表、凭证、客户和供应商、发票、收付款和预算。',
      level: 1,
      dimensions: ['concept', 'apply'],
      prereqs: ['db-basics'],
      lesson: {
        sections: [
          {
            heading: '练习用的这家公司',
            body: [
              '本课程配了一套练习数据：虚构的“晴川文具贸易有限公司”，做办公文具批发，有 2026 年 1 月到 3 月的账，金额都是人民币，增值税税率 13%。数据库的名字叫 acct_practice。',
              '为了好学，表结构比真实的财务软件简单。金蝶、用友、SAP 等系统的表更多，名字也不一样，但思路相同：找到凭证、科目、往来单位这几类表，搞清它们怎么连在一起。',
            ],
          },
          {
            heading: '凭证为什么分成两张表',
            body: [
              '一张记账凭证有“表头”（凭证号、日期、摘要）和若干行分录（科目、借方、贷方）。数据库里通常把它拆成两张表：vouchers（凭证头）每张凭证一行；voucher_lines（凭证分录行）每条分录一行，用 voucher_id（凭证内部编号）指回它属于哪张凭证。',
              '这种“一张对多行”的关系叫一对多。好处是表头信息只存一次，分录想有几行就有几行。下面是一笔销售（2026-01-003 号凭证，内部编号 voucher_id 是 4）的分录：',
              { code: `SELECT line_no, account_code, customer_id, debit, credit
FROM voucher_lines
WHERE voucher_id = 4;`,
                result: 'line_no\taccount_code\tcustomer_id\tdebit\tcredit\n1\t1122\tC001\t63280.00\t0.00\n2\t6001\tNULL\t0.00\t56000.00\n3\t2221\tNULL\t0.00\t7280.00' },
              'debit 是借方金额，credit 是贷方金额，每行只有一边有数，另一边是 0。这张凭证是：借 1122 应收账款，贷 6001 主营业务收入和 2221 应交税费。借方合计 63,280.00 等于贷方合计 56,000.00 + 7,280.00。',
            ],
          },
          {
            heading: '辅助核算：分录上的客户、供应商和部门',
            body: [
              '财务软件里的“辅助核算”，在这里就是分录行上的三列：customer_id（客户）、vendor_id（供应商）、dept_id（部门）。应收账款的分录带客户，应付账款的分录带供应商，费用的分录带部门。',
              '用不到的格子就空着，数据库里叫 NULL（空值），意思是“没有填”。NULL 不是 0，也不是空白文字。上面那张凭证里，收入和税费两行的 customer_id 就是 NULL。',
              '还有一张特别的凭证：2025-12-000 号，日期 2025-12-31，摘要“期初余额”，记的是 2025 年末各科目的余额，相当于开账。',
            ],
          },
          {
            heading: '练习库里的全部表',
            body: [
              '每张表都写了中文说明，可以这样查出来：',
              { code: `SELECT table_name AS 表名, table_comment AS 说明
FROM information_schema.tables
WHERE table_schema = 'acct_practice'
ORDER BY table_name;`,
                result: '表名\t说明\naccounts\t会计科目表\nap_invoices\t应付发票（采购和费用）\nap_payment_applications\t付款核销明细\nap_payments\t向供应商付款\nar_invoices\t应收发票（销售开票）\nar_receipt_applications\t收款核销明细：一笔收款可以核销多张发票\nar_receipts\t客户收款\nbudgets\t月度费用预算\ncustomers\t客户\ndepartments\t部门\nvendors\t供应商\nvoucher_lines\t凭证分录行\nvouchers\t凭证头' },
              'accounts 是科目表：account_code 科目代码，account_name 科目名称，category 科目类别（资产、负债、所有者权益、损益），balance_side 余额方向（借或贷）。',
              'AR 是应收账款（accounts receivable）的缩写，AP 是应付账款（accounts payable）的缩写。ar_invoices 是开给客户的发票，ar_receipts 是客户付来的款，ar_receipt_applications 记“哪笔收款核销了哪张发票、核销多少”。应付这边的三张表一一对应。',
            ],
          },
        ],
        askQuestions: [
          '财务软件里的“辅助核算”在数据库里一般是怎么存的？',
          '为什么凭证要拆成凭证头和分录行两张表，而不是放在一张表里？',
          '一笔收款对应多张发票的核销记录，在实际的财务软件里一般怎么存？',
        ],
        task: {
          prompt: '对照本节的表清单，在纸上画一张草图：凭证、分录、科目、客户、发票、收款之间怎么连接。',
          criteria: [
            '画出 vouchers 和 voucher_lines 之间的一对多关系，并标出连接它们的列 voucher_id',
            '标出 voucher_lines 通过 account_code 连到 accounts',
            '标出 ar_invoices、ar_receipts 和 ar_receipt_applications 三张表之间的关系',
            '用一句话说明：为什么一笔收款在核销表里可能有好几行',
          ],
        },
        reflection: {
          question: '分录行上的 customer_id 为什么只有应收账款那一行有值，收入和税费两行是空的（NULL）？',
          answer: '因为客户这个辅助核算只对往来科目有意义。销售凭证里，应收账款记的是“谁欠我们钱”，必须带客户；收入和税费按科目汇总就够了，不需要按客户核算，所以那两行不填，数据库里就是 NULL。以后写查询要记住：NULL 表示“没有填”，它既不等于 0，也不等于空白文字。',
        },
        quiz: [
          {
            id: 'acct-tables-q1',
            prompt: '一张凭证有 1 个表头和 4 行分录。在练习库里，它在 vouchers 和 voucher_lines 两张表里各占几行？',
            options: ['vouchers 4 行，voucher_lines 1 行', 'vouchers 1 行，voucher_lines 4 行', '两张表各 4 行', '两张表各 1 行'],
            answer: 1,
            explanation: '凭证头每张凭证一行，分录每条一行。两张表靠 voucher_id 连在一起，这就是一对多。',
          },
          {
            id: 'acct-tables-q2',
            prompt: '这是一张采购入库凭证（2026-01-005 号）的分录。哪一行记的是欠供应商的钱？',
            code: `SELECT line_no, account_code, vendor_id, debit, credit
FROM voucher_lines
WHERE voucher_id = 6;`,
            options: ['第 1 行：1405 库存商品，借方增加了库存', '第 2 行：2221 应交税费，借方记的是要交给税务局的钱', '第 3 行：2202 应付账款，带供应商，记在贷方'],
            answer: 2,
            explanation: '2202 应付账款是负债，增加记在贷方，并且带着供应商编号（辅助核算）。1405 是入库的商品，2221 借方是可以抵扣的进项税。',
          },
          {
            id: 'acct-tables-q3',
            prompt: '想知道“某张应收发票被哪几笔收款核销过”，主要应该看哪张表？',
            options: ['customers（客户表，里面记着每个客户的付款）', 'ar_receipt_applications', 'ar_invoices（发票表，每张发票上记着收了哪几笔款）', 'accounts'],
            answer: 1,
            explanation: '核销关系记在 ar_receipt_applications：每行是“哪笔收款、核销到哪张发票、核销多少”。发票表本身只记开票金额。',
          },
        ],
      },
    },
    {
      id: 'setup',
      stage: 'basics',
      title: '在 Mac 上装好 MySQL，导入练习数据',
      summary: '装好 MySQL 服务器和一个免费的图形界面工具，导入练习账套，确认能查。',
      level: 2,
      dimensions: ['concept'],
      prereqs: ['acct-tables'],
      lesson: {
        sections: [
          {
            heading: '先搞清楚要装什么',
            body: [
              'MySQL 分两部分：服务器，是真正存数据、执行查询的程序，在后台运行；客户端，是你用来输入 SQL、看结果的工具。Mac 自带的“终端”App（输入命令的窗口）就可以当客户端，也可以另装一个有界面的工具。',
              '本课程推荐的界面工具是 Sequel Ace：免费、开源，专门用于 MySQL，要求 macOS 13 或更新。动手之前，先点屏幕左上角的苹果菜单 →“关于本机”，看看你的 macOS 版本。',
            ],
          },
          {
            heading: '安装 MySQL 服务器',
            body: [
              'macOS 15 或更新：用 Homebrew（Mac 上常用的免费安装工具，官网 brew.sh 首页有一行安装命令）。装好 Homebrew 后，在终端里依次运行下面三行。最后一行能显示版本号，就说明装好了：',
              { lang: 'shell', code: `brew install mysql
brew services start mysql
mysql -u root -e "SELECT VERSION();"` },
              'Homebrew 装的 MySQL，管理员账号 root 默认没有密码，只允许本机连接。brew services start 会让它开机自动运行；不想要时用 brew services stop mysql 停掉。',
              'macOS 14 或更早：Homebrew 已经不再为这些系统提供现成的安装包，会改成从源代码编译，常因为“Command Line Tools 太旧”而失败。更省事的办法是用 MySQL 官网的安装包：在 dev.mysql.com 的下载页面进入 Archives（历史版本），选 MySQL Community Server 8.4.3、对应的 macOS 版本和芯片（Apple 芯片选 ARM），下载 .dmg 文件，双击安装，按提示给 root 设一个密码并记好。',
              '官网安装包会把 MySQL 装在 /usr/local/mysql 文件夹里，但不会告诉终端去哪里找它。终端只认识放在几个固定文件夹里的命令，所以这时直接输入 mysql 会提示“command not found”（找不到命令）。最简单的办法是每次写完整路径，用 /usr/local/mysql/bin/mysql 代替 mysql；也可以运行下面这行，把这个文件夹加进终端的查找范围（PATH），然后关掉终端重新打开：',
              { lang: 'shell', code: `echo 'export PATH="/usr/local/mysql/bin:$PATH"' >> ~/.zshrc` },
              '电脑上以前装过 MySQL 的，要先确认一下：旧的服务器可能还在后台运行，占着默认的 3306 端口，新装的服务器就启动不了；或者你以为连的是新服务器，其实连的是旧的，要用旧的密码。打开“系统设置”，拉到最下面看有没有 MySQL 图标，有的话就是装过，可以在那里停掉旧服务器。拿不准的，请懂的同事帮忙看一下。',
            ],
          },
          {
            heading: '导入练习数据',
            body: [
              '练习文件在 mysql-accounting 文件夹里，一共三个文件：schema-and-data.sql 建表并写入数据；answers.sql 是各课任务的参考答案和预期结果；README.md 是说明。这个文件夹放在本网站的 practice 目录下：在浏览器地址栏里，把本网站地址后面加上 practice/mysql-accounting/ 和文件名，就能打开或下载。',
              '打开终端，输入 cd 和一个空格，把 mysql-accounting 文件夹拖进终端窗口，按回车，就进入了这个文件夹。然后导入（root 没有密码时）：',
              { lang: 'shell', code: `mysql -u root < schema-and-data.sql` },
              '用官网安装包装的（root 有密码），要写完整路径并加上 -p，回车后输入 root 的密码：',
              { lang: 'shell', code: `/usr/local/mysql/bin/mysql -u root -p < schema-and-data.sql` },
              '如果你的服务器用的不是默认的 3306 端口，再加上 -P 和端口号，比如 -P 3307。',
              '这个文件的第一句会删除并重新建立 acct_practice 数据库，所以练坏了随时可以再导入一次，回到原样。导入后检查一下，应该是 325 行分录：',
              { code: `SELECT COUNT(*) AS 分录行数 FROM voucher_lines;`,
                result: '分录行数\n325' },
            ],
          },
          {
            heading: '用 Sequel Ace 连接',
            body: [
              '安装：在 Mac 的 App Store 里搜索 Sequel Ace 安装；用 Homebrew 的也可以在终端运行下面这行：',
              { lang: 'shell', code: `brew install --cask sequel-ace` },
              '打开后选“Standard”连接方式：Host 填 127.0.0.1，Username 填 root，Password 按你的安装填写（Homebrew 默认留空），Port 填 3306（你的服务器用了别的端口的，填那个端口），点 Connect。连上后在左上角选数据库 acct_practice，点顶部的 Query 进入查询页，输入 SQL 后点运行按钮就能看到结果。',
            ],
          },
          {
            heading: '装不上怎么办',
            body: [
              '公司电脑没有安装权限，或者一时装不上，也可以先往下学：每节课的代码下面都附了真实的运行结果，可以对照着读懂；任务的参考答案和预期结果都在 answers.sql 里，用任何文本编辑器都能打开。',
              '等有条件了再装，或者请 IT 同事帮忙装一个本机练习用的 MySQL。不要拿公司正式的数据库做练习。',
            ],
          },
        ],
        askQuestions: [
          '我的 Mac 是 macOS 14，用 Homebrew 装 MySQL 时提示 Command Line Tools 太旧，应该怎么办？',
          'MySQL 的 root 账号是什么？本机练习时 root 不设密码有什么风险？',
          'Sequel Ace 连不上本机的 MySQL，常见原因有哪些？应该按什么顺序排查？',
        ],
        task: {
          prompt: '按本节步骤装好 MySQL 和 Sequel Ace（或者只用终端），导入练习数据，确认导入成功。',
          criteria: [
            'MySQL 服务器已经启动，能在终端或 Sequel Ace 里连上',
            '导入 schema-and-data.sql 没有报错',
            '运行本节最后那条查询，结果是 325',
            '记下自己的连接信息：主机、端口、账号，以及密码存放在哪里',
          ],
        },
        reflection: {
          question: '练习数据文件的第一句为什么要先删除、再重建数据库？这对练习有什么好处，又有什么要小心的？',
          answer: '好处是“随时可以回到原样”：不管练习时把数据改成什么样，再导入一次，所有表都恢复到一模一样的初始状态，练习结果也能和答案对上。要小心的是，这句只能用在练习库上：它会把 acct_practice 整个删掉，导入前要确认你连的是自己电脑上的练习服务器，而且没有在这个库里存别的东西。正式数据库上绝不能运行这种文件。',
        },
        quiz: [
          {
            id: 'setup-q1',
            prompt: '关于 MySQL 服务器和客户端，哪种说法对？',
            options: ['服务器存数据、执行查询；终端和 Sequel Ace 只是客户端', 'Sequel Ace 自己保存了一份数据，关掉 MySQL 服务器以后也能继续查', '终端和 Sequel Ace 只能二选一'],
            answer: 0,
            explanation: '数据在服务器里。客户端只负责把你写的 SQL 发给服务器，再把结果显示出来。服务器没启动，任何客户端都连不上。',
          },
          {
            id: 'setup-q2',
            prompt: '练习时不小心把数据改乱了，最省事的恢复办法是？',
            options: ['卸载并重装 MySQL，让数据库回到刚装好时的样子', '重新导入 schema-and-data.sql', '对照 answers.sql 一行一行手工改回来', '卸载 Sequel Ace 再装一次'],
            answer: 1,
            explanation: '练习文件会先删除再重建 acct_practice，导入一次就回到初始状态。重装 MySQL 没必要，手工改回来容易漏。',
          },
        ],
      },
    },

    // ------------------------------------------------------------ stage 2
    {
      id: 'select-basics',
      stage: 'query',
      title: '查数据：挑列、筛选、排序',
      summary: 'SELECT、WHERE、ORDER BY、LIMIT，以及最容易踩坑的空值 NULL。',
      level: 1,
      dimensions: ['read'],
      prereqs: ['acct-tables'],
      lesson: {
        sections: [
          {
            heading: 'SELECT：要哪几列',
            body: [
              '最基本的查询是“SELECT 列 FROM 表;”，意思是从某张表里取出这几列。SELECT 是“选择”，FROM 是“从哪里”，每条语句用英文分号结尾。关键字大写小写都行，本课程用大写，方便和表名、列名区分。',
              { code: `SELECT customer_id, customer_name, credit_days
FROM customers;`,
                result: 'customer_id\tcustomer_name\tcredit_days\nC001\t北辰科技有限公司\t30\nC002\t东湖教育培训中心\t45\nC003\t南山设计工作室\t30\nC004\t西岭连锁书店\t60\nC005\t青松物业管理有限公司\t30\nC006\t海棠酒店管理有限公司\t45' },
              '这就像在 Excel 里只留下三列、把其他列隐藏。SELECT * 表示所有列，想看看一张表里有什么时很方便；正式取数时最好写清楚要哪几列。',
            ],
          },
          {
            heading: 'WHERE：只要满足条件的行',
            body: [
              'WHERE 后面写筛选条件，相当于 Excel 的筛选。文字和日期要用英文单引号括起来，数字不用。AND 是“并且”，两个条件都要满足：',
              { code: `SELECT invoice_no, customer_id, invoice_date, total_amount
FROM ar_invoices
WHERE customer_id = 'C004' AND total_amount >= 60000;`,
                result: 'invoice_no\tcustomer_id\tinvoice_date\ttotal_amount\nXS-2511-021\tC004\t2025-11-20\t90400.00\nXS-2601-009\tC004\t2026-01-30\t79100.00\nXS-2603-004\tC004\t2026-03-12\t67800.00' },
              'OR 是“或者”，满足一个就行。AND 和 OR 一起用时，数据库先算 AND，所以一定要用括号写清楚你的意思：',
              { code: `SELECT customer_id, customer_name, city, credit_days
FROM customers
WHERE (city = '北京' OR city = '厦门') AND credit_days >= 45;`,
                result: 'customer_id\tcustomer_name\tcity\tcredit_days\nC006\t海棠酒店管理有限公司\t厦门\t45' },
              'LIKE 用来按部分文字查找，% 代表“任意几个字”。下面找出摘要里有“差旅”的凭证：',
              { code: `SELECT voucher_no, voucher_date, description
FROM vouchers
WHERE description LIKE '%差旅%'
ORDER BY voucher_date;`,
                result: 'voucher_no\tvoucher_date\tdescription\n2026-01-007\t2026-01-07\t销售人员差旅费报销\n2026-01-026\t2026-01-24\t销售人员差旅费报销\n2026-02-010\t2026-02-07\t销售人员差旅费报销\n2026-02-032\t2026-02-24\t销售人员差旅费报销\n2026-03-011\t2026-03-07\t销售人员差旅费报销\n2026-03-033\t2026-03-24\t销售人员差旅费报销' },
            ],
          },
          {
            heading: 'ORDER BY 和 LIMIT：排序、只看前几行',
            body: [
              'ORDER BY 某列，就按这一列排序，默认从小到大；后面加 DESC 是从大到小。LIMIT 5 表示只要前 5 行。“金额最大的 5 张应收发票”这样写：',
              { code: `SELECT invoice_no, customer_id, total_amount
FROM ar_invoices
ORDER BY total_amount DESC, invoice_no
LIMIT 5;`,
                result: 'invoice_no\tcustomer_id\ttotal_amount\nXS-2511-021\tC004\t90400.00\nXS-2601-009\tC004\t79100.00\nXS-2602-002\tC001\t70060.00\nXS-2512-007\tC001\t67800.00\nXS-2603-004\tC004\t67800.00' },
              '第 4、5 名的金额都是 67,800.00。只按金额排序的话，金额相同的两行谁先谁后是不确定的，所以后面又加了按发票号排序，保证每次结果一样。',
              '记住：没写 ORDER BY 时，数据库不保证结果的顺序。需要按顺序看，就一定要写。',
            ],
          },
          {
            heading: '空值 NULL：要用 IS NULL 来找',
            body: [
              '找没填电话的客户，要写 IS NULL：',
              { code: `SELECT customer_id, customer_name
FROM customers
WHERE contact_phone IS NULL;`,
                result: 'customer_id\tcustomer_name\nC003\t南山设计工作室\nC006\t海棠酒店管理有限公司' },
              '如果写成“= NULL”，一行也查不出来：',
              { code: `SELECT customer_id, customer_name
FROM customers
WHERE contact_phone = NULL;`,
                result: 'customer_id\tcustomer_name' },
              '原因是：NULL 表示“不知道”，拿它和任何值比较，结果也是“不知道”，而不是“是”，所以没有一行被选出来。找有值的行用 IS NOT NULL。',
            ],
          },
        ],
        askQuestions: [
          'AND 和 OR 混在一起时，数据库先算哪个？有没有好记的规则？',
          'LIKE 里的 % 和 _ 分别代表什么？查找内容里本身有 % 时怎么办？',
          '为什么说正式取数时不要用 SELECT *？',
        ],
        task: {
          prompt: '在练习库里写三条查询。写不出来时，可以参考 answers.sql 里第 4 课的答案。',
          criteria: [
            '列出所有供应商的编号、名称和付款期，按付款期从短到长排序',
            '找出 2026 年 3 月开出的、价税合计在 5 万元以上的应收发票',
            '找出摘要里含“招待”的凭证，按凭证日期排序',
            '三条查询的结果都和 answers.sql 里的预期结果一致',
          ],
        },
        reflection: {
          question: '“WHERE contact_phone = NULL”为什么查不出任何行？写查询时怎么避免这类错误？',
          answer: 'NULL 的意思是“没有值、不知道”，它和任何东西比较（包括和另一个 NULL 比较）结果都是“不知道”，WHERE 只保留结果为“是”的行，所以一行也不会被选出来。要找空值必须写 IS NULL，找非空写 IS NOT NULL。养成习惯：看到可能为空的列（电话、部门、客户），先想一想空值会被算在哪一边。',
        },
        quiz: [
          {
            id: 'select-basics-q1',
            prompt: '五个供应商的付款期分别是：S001 30 天，S002 45 天，S003 30 天，S004 15 天，S005 30 天。下面这条查询返回哪些供应商？',
            code: `SELECT vendor_id, vendor_name
FROM vendors
WHERE payment_days > 30;`,
            options: ['S001、S002、S003、S005', '只有 S004', '只有 S002', '所有供应商'],
            answer: 2,
            explanation: '> 30 是“大于 30”，不含 30 本身，所以只有付款期 45 天的恒达笔业（S002）。要包含 30 天，应写 >= 30。',
          },
          {
            id: 'select-basics-q2',
            prompt: '同事想找“在北京或厦门，并且信用期 45 天以上”的客户，写了下面这条。它的问题是什么？',
            code: `SELECT customer_name, city, credit_days
FROM customers
WHERE city = '北京' OR city = '厦门' AND credit_days >= 45;`,
            options: ['没有问题，AND 和 OR 按从左到右的顺序算，结果正确', 'AND 先算，北京客户不论信用期都被选出，要加括号', '应该用 LIKE 代替 =，因为城市名后面可能有空格', '城市名不能直接写中文，要换成拼音或编号'],
            answer: 1,
            explanation: '这条实际是“北京的客户，或者（厦门并且信用期 45 天以上）的客户”，所以信用期只有 30 天的北辰科技也被选出来了。写成 (city = 北京 OR city = 厦门) AND ... 才对。',
          },
          {
            id: 'select-basics-q3',
            prompt: '“ORDER BY total_amount DESC LIMIT 3”是什么意思？',
            options: ['按金额从大到小排序，只取前 3 行', '按金额从小到大排序，只取前 3 行', '只取金额等于 3 的行', '跳过前 3 行'],
            answer: 0,
            explanation: 'DESC 是从大到小（降序），LIMIT 3 只保留排序后的前 3 行，也就是金额最大的 3 行。',
          },
        ],
      },
    },
    {
      id: 'aggregate',
      stage: 'query',
      title: '汇总：合计、计数、分组',
      summary: 'SUM、COUNT、GROUP BY、HAVING，相当于 SQL 里的数据透视表。',
      level: 1,
      dimensions: ['read', 'apply'],
      prereqs: ['select-basics'],
      lesson: {
        sections: [
          {
            heading: 'SUM 和 COUNT：把一张表算成一个数',
            body: [
              'SUM(列) 是求和，COUNT(*) 是数行数，和 Excel 的 SUM、COUNTA 差不多。AS 用来给结果列起个名字，可以用中文。下面算 2026 年开出的应收发票：',
              { code: `SELECT COUNT(*) AS 发票张数, SUM(total_amount) AS 价税合计
FROM ar_invoices
WHERE invoice_date >= '2026-01-01';`,
                result: '发票张数\t价税合计\n28\t1144690.00' },
              '另外还有 AVG（平均）、MAX（最大）、MIN（最小），用法一样。',
            ],
          },
          {
            heading: 'GROUP BY：分组汇总',
            body: [
              'GROUP BY 某列，就是按这一列分组，每组算一次汇总，相当于数据透视表里把这一列拖到“行”。下面按客户汇总 2026 年的开票：',
              { code: `SELECT customer_id, COUNT(*) AS 张数, SUM(total_amount) AS 价税合计
FROM ar_invoices
WHERE invoice_date >= '2026-01-01'
GROUP BY customer_id
ORDER BY 价税合计 DESC;`,
                result: 'customer_id\t张数\t价税合计\nC001\t6\t348492.00\nC002\t5\t228034.00\nC004\t3\t205660.00\nC006\t5\t161816.00\nC005\t4\t105090.00\nC003\t5\t95598.00' },
              '规则：SELECT 里不在 SUM、COUNT 这类汇总函数里的列，都要写进 GROUP BY。上面 customer_id 没有被汇总，所以它就是分组的依据。违反这条规则，MySQL 一般会直接报错。',
            ],
          },
          {
            heading: 'HAVING：对汇总结果再筛选',
            body: [
              'WHERE 在分组之前筛选“行”，HAVING 在分组之后筛选“组”。找出 2026 年开票 6 张以上的客户：',
              { code: `SELECT customer_id, COUNT(*) AS 张数
FROM ar_invoices
WHERE invoice_date >= '2026-01-01'
GROUP BY customer_id
HAVING COUNT(*) >= 6;`,
                result: 'customer_id\t张数\nC001\t6' },
              '第 8 课的借贷平衡检查就是这么做的：按凭证分组，留下借方合计不等于贷方合计的组。',
            ],
          },
          {
            heading: 'COUNT(*) 和 COUNT(列) 不一样',
            body: [
              'COUNT(*) 数的是行数；COUNT(某列) 只数这一列不是 NULL 的行：',
              { code: `SELECT COUNT(*) AS 客户数, COUNT(contact_phone) AS 有电话的客户数
FROM customers;`,
                result: '客户数\t有电话的客户数\n6\t4' },
              '同样，SUM 会跳过 NULL；如果一组里全是 NULL，SUM 的结果是 NULL，而不是 0。',
            ],
          },
        ],
        askQuestions: [
          'WHERE 和 HAVING 都能筛选，什么时候必须用 HAVING？',
          'GROUP BY 两列（比如部门和科目）时，结果是怎么分组的？',
          'SUM 一组里全是 NULL 时返回 NULL，怎样让它显示 0？',
        ],
        task: {
          prompt: '用练习库完成下面的汇总。参考答案在 answers.sql 第 5 课。',
          criteria: [
            '按供应商汇总 2026 年收到的应付发票（ap_invoices）：张数和价税合计',
            '按部门统计分录行里带部门的行数（dept_id 不为空）',
            '找出 2026 年收款 4 次以上的客户（ar_receipts）',
            '结果和 answers.sql 的预期一致',
          ],
        },
        reflection: {
          question: '用数据透视表打个比方：GROUP BY、SUM、HAVING 分别对应透视表里的什么操作？',
          answer: 'GROUP BY 相当于把某个字段拖到“行”区域，按它分组；SUM、COUNT 相当于把金额拖到“值”区域，并选择求和或计数；HAVING 相当于在透视结果上再做“值筛选”，比如只看合计大于某个数的行。WHERE 则像是在做透视表之前先筛选源数据。',
        },
        quiz: [
          {
            id: 'aggregate-q1',
            prompt: '这条查询返回什么？',
            code: `SELECT customer_id, SUM(amount) AS 收款合计
FROM ar_receipts
GROUP BY customer_id
HAVING SUM(amount) > 200000;`,
            options: ['每一笔超过 20 万元的收款，以及收款日期', '所有客户的收款合计', '收款合计超过 20 万元的客户和合计'],
            answer: 2,
            explanation: '先按客户分组求和，HAVING 再筛掉合计不超过 20 万元的组。单笔金额大不大不影响，看的是合计。练习库里只有北辰科技（C001）超过，289,958.00。',
          },
          {
            id: 'aggregate-q2',
            prompt: '客户表有 6 个客户，其中 2 个没填电话。下面这条返回几？',
            code: `SELECT COUNT(contact_phone) AS 数量 FROM customers;`,
            options: ['6', 'NULL', '2', '4'],
            answer: 3,
            explanation: 'COUNT(列) 只数这一列不是 NULL 的行，6 个客户里有 4 个填了电话。想数全部客户要用 COUNT(*)。',
          },
          {
            id: 'aggregate-q3',
            prompt: '按部门分组时，SELECT 里还想显示科目代码 account_code，应该怎么办？',
            options: ['把 account_code 也写进 GROUP BY', '什么都不用改，MySQL 会自动从每组里挑一个科目显示', '把 GROUP BY 删掉，改成在 WHERE 里写部门条件'],
            answer: 0,
            explanation: '不在汇总函数里的列都要写进 GROUP BY。加上 account_code 后，每个“部门 + 科目”组合算一行，这正是费用分析常用的粒度。',
          },
        ],
      },
    },
    {
      id: 'dates',
      stage: 'query',
      title: '日期和会计期间',
      summary: '按月汇总、期间边界、算天数，以及凭证日期和录入时间的区别。',
      level: 2,
      dimensions: ['read', 'apply'],
      prereqs: ['aggregate'],
      lesson: {
        sections: [
          {
            heading: '日期在数据库里怎么写',
            body: [
              "日期一律写成“年-月-日”，加英文单引号，比如 '2026-03-31'。DATE（日期）类型只有年月日；DATETIME（日期时间）还带时分秒，比如凭证的录入时间 created_at 是 '2026-03-31 18:20:00'。",
              '凭证属于哪个会计期间，看 voucher_date（凭证日期），不看录入时间。1 月的工资凭证可能 2 月 1 日早上才录入，但它仍然属于 1 月。',
            ],
          },
          {
            heading: '按月汇总：DATE_FORMAT',
            body: [
              "DATE_FORMAT(日期, '%Y-%m') 把日期变成“2026-01”这样的年月，再按它分组，就是按月汇总：",
              { code: `SELECT DATE_FORMAT(invoice_date, '%Y-%m') AS 月份,
       COUNT(*) AS 张数,
       SUM(net_amount) AS 不含税销售额
FROM ar_invoices
WHERE invoice_date >= '2026-01-01'
GROUP BY 月份
ORDER BY 月份;`,
                result: '月份\t张数\t不含税销售额\n2026-01\t9\t344800.00\n2026-02\t9\t305600.00\n2026-03\t10\t362600.00' },
              'YEAR() 和 MONTH() 可以分别取出年和月。只用 MONTH() = 3 筛选时要小心：数据跨年的话，去年 3 月的数据也会被算进来，记得同时限制年份。',
            ],
          },
          {
            heading: '期间边界：最容易出错的地方',
            body: [
              '筛选一个月，最稳妥的写法是“大于等于月初，并且小于下月初”：',
              { code: `SELECT COUNT(*) AS 张数
FROM vouchers
WHERE voucher_date >= '2026-01-01' AND voucher_date < '2026-02-01';`,
                result: '张数\n38' },
              "如果对带时间的列用 BETWEEN '2026-01-01' AND '2026-01-31'，结尾的 '2026-01-31' 会被当成 1 月 31 日零点，当天零点以后的记录都会被漏掉：",
              { code: `SELECT COUNT(*) AS 张数
FROM vouchers
WHERE created_at BETWEEN '2026-01-01' AND '2026-01-31';`,
                result: '张数\n33' },
              '少掉的 5 张：1 月 31 日当天录入的 4 张凭证，加上 2 月 1 日早上才录入的 1 月工资凭证。按月取数时用凭证日期，并用“小于下月初”的写法，两个问题都能避免。',
            ],
          },
          {
            heading: '算天数：DATEDIFF',
            body: [
              "DATEDIFF(日期1, 日期2) 算日期1 比日期2 晚几天。账龄、逾期天数都靠它。截止日要写成固定日期，比如 '2026-03-31'，不要用 CURDATE()（今天的日期）：否则每天运行的结果都不一样，也对不上账面的期末数。",
              { code: `SELECT invoice_no, invoice_date, due_date,
       DATEDIFF('2026-03-31', due_date) AS 逾期天数
FROM ar_invoices
WHERE customer_id = 'C004'
ORDER BY invoice_date;`,
                result: 'invoice_no\tinvoice_date\tdue_date\t逾期天数\nXS-2511-021\t2025-11-20\t2026-01-19\t71\nXS-2601-009\t2026-01-30\t2026-03-31\t0\nXS-2602-005\t2026-02-17\t2026-04-18\t-18\nXS-2603-004\t2026-03-12\t2026-05-11\t-41' },
              '负数表示截至 3 月 31 日还没到期。注意这里还没扣掉已经收回的钱，哪些发票真的没收完，第 9 课再算。',
            ],
          },
        ],
        askQuestions: [
          'DATE 和 DATETIME 有什么区别？筛选一个月的数据时，两种类型分别该怎么写？',
          '会计期间按凭证日期和按录入时间统计，结果为什么会不同？审计时更关心哪个？',
          '如果公司的会计期间不是自然月（比如每月 26 日结账），按月汇总的 SQL 要怎么改？',
        ],
        task: {
          prompt: '练习日期相关的查询。参考答案在 answers.sql 第 6 课。',
          criteria: [
            '按月统计 2026 年 1–3 月的凭证张数（按凭证日期）',
            '找出凭证日期和录入日期不是同一天的凭证（提示：DATE(created_at) 取出录入时间里的日期）',
            '列出凭证日期是 3 月 31 日的所有凭证和它们的录入时间',
            '结果和 answers.sql 的预期一致',
          ],
        },
        reflection: {
          question: '为什么筛选一个月时推荐写“>= 月初 并且 < 下月初”，而不是 BETWEEN 月初 AND 月末？',
          answer: '因为这种写法对 DATE 和 DATETIME 都正确：带时间的记录只要在下月初零点之前，都会被包括进来，月末最后一天的任何时刻都不会漏；也不用操心每个月有几天、2 月是 28 天还是 29 天。BETWEEN 对只有日期的列没问题，但一用到带时间的列就会漏掉月末当天，而且这个错误不会报错，很难发现。',
        },
        quiz: [
          {
            id: 'dates-q1',
            prompt: 'voucher_date 是 DATE 类型（只有日期，没有时间）。下面这条能不能取全 3 月的凭证？',
            code: `SELECT COUNT(*) AS 张数
FROM vouchers
WHERE voucher_date BETWEEN '2026-03-01' AND '2026-03-31';`,
            options: ['不能，BETWEEN 不包括结尾那天，会漏掉 3 月 31 日的凭证', '能，DATE 没有时间部分，BETWEEN 两头都包括', '不能，BETWEEN 会把 4 月 1 日零点的凭证也算进来'],
            answer: 1,
            explanation: 'BETWEEN 包括两端。对只有日期的列，3 月 31 日就是 3 月 31 日，不会漏。会漏的是带时间的列。习惯上统一写“< 下月初”，就不用每次分辨列的类型。',
          },
          {
            id: 'dates-q2',
            prompt: '同事想算发票截至 2026-03-31 开出了多少天，结果是 -29。问题出在哪？',
            code: `SELECT invoice_no, DATEDIFF(invoice_date, '2026-03-31') AS 天数
FROM ar_invoices
WHERE invoice_no = 'XS-2603-001';`,
            options: ['发票日期录错了，应该先核对原始发票', '应该用 BETWEEN 来算两个日期之间的天数', '两个日期写反了，截止日应该在前', '应该用 CURDATE()'],
            answer: 2,
            explanation: 'DATEDIFF(日期1, 日期2) = 日期1 − 日期2。截止日在前才得到正数 29。用 CURDATE() 会让结果每天都变，不适合对账。',
          },
          {
            id: 'dates-q3',
            prompt: '1 月的工资凭证，凭证日期是 1 月 31 日，2 月 1 日早上才录入系统。按会计期间汇总时它属于哪个月？',
            options: ['1 月，期间看凭证日期', '2 月，因为是 2 月 1 日才录入系统的', '不属于任何月份'],
            answer: 0,
            explanation: '会计期间由凭证日期决定。录入时间只说明什么时候录进系统，用来审核操作，不决定期间。',
          },
        ],
      },
    },
    {
      id: 'joins',
      stage: 'query',
      title: '把多张表连起来（JOIN）',
      summary: '用 JOIN 代替 VLOOKUP，分清 JOIN 和 LEFT JOIN，留意一对多。',
      level: 1,
      dimensions: ['read'],
      prereqs: ['aggregate'],
      lesson: {
        sections: [
          {
            heading: 'JOIN 就像 VLOOKUP',
            body: [
              '分录行里只有科目代码，没有科目名称，名称在科目表里。在 Excel 里你会用 VLOOKUP 按代码把名称查过来；SQL 里用 JOIN（连接）：',
              { code: `SELECT l.line_no, l.account_code, a.account_name, l.debit, l.credit
FROM voucher_lines l
JOIN accounts a ON a.account_code = l.account_code
WHERE l.voucher_id = 4;`,
                result: 'line_no\taccount_code\taccount_name\tdebit\tcredit\n1\t1122\t应收账款\t63280.00\t0.00\n2\t6001\t主营业务收入\t0.00\t56000.00\n3\t2221\t应交税费\t0.00\t7280.00' },
              '“voucher_lines l”里的 l 是给表起的简称（别名），后面的 l.debit 就是“分录行表的 debit 列”。ON 后面写两张表按哪一列对上，相当于 VLOOKUP 的查找值和查找列。',
            ],
          },
          {
            heading: '三张表一起连：凭证头 + 分录 + 科目',
            body: [
              { code: `SELECT v.voucher_no, v.voucher_date, a.account_name, l.dept_id, l.debit, l.credit
FROM vouchers v
JOIN voucher_lines l ON l.voucher_id = v.voucher_id
JOIN accounts a ON a.account_code = l.account_code
WHERE v.voucher_no = '2026-01-036';`,
                result: 'voucher_no\tvoucher_date\taccount_name\tdept_id\tdebit\tcredit\n2026-01-036\t2026-01-31\t管理费用\tD01\t12000.00\t0.00\n2026-01-036\t2026-01-31\t销售费用\tD02\t18600.00\t0.00\n2026-01-036\t2026-01-31\t销售费用\tD03\t8000.00\t0.00\n2026-01-036\t2026-01-31\t管理费用\tD04\t7000.00\t0.00\n2026-01-036\t2026-01-31\t应付职工薪酬\tNULL\t0.00\t45600.00' },
              '这就是一张“看得懂”的凭证：凭证号和日期来自凭证头，科目名称来自科目表，部门和金额来自分录行。这是 1 月计提工资：销售部和仓储物流部的工资记销售费用，管理部和财务部的记管理费用。',
            ],
          },
          {
            heading: 'JOIN 和 LEFT JOIN 的区别',
            body: [
              'JOIN（也写作 INNER JOIN）只保留两边都对得上的行。LEFT JOIN 保留左边表的所有行，右边对不上的就填 NULL。',
              '想看每个资产类科目有几行分录，要用 LEFT JOIN，才能把一笔都没发生过的科目也列出来：',
              { code: `SELECT a.account_code, a.account_name, COUNT(l.line_id) AS 分录行数
FROM accounts a
LEFT JOIN voucher_lines l ON l.account_code = a.account_code
WHERE a.category = '资产'
GROUP BY a.account_code, a.account_name
ORDER BY a.account_code;`,
                result: 'account_code\taccount_name\t分录行数\n1001\t库存现金\t8\n1002\t银行存款\t73\n1122\t应收账款\t50\n1221\t其他应收款\t0\n1405\t库存商品\t14\n1601\t固定资产\t1\n1602\t累计折旧\t4' },
              '1221 其他应收款没有任何分录，行数是 0。把 LEFT JOIN 换成 JOIN，这一行就不见了。这里要数 COUNT(l.line_id) 而不是 COUNT(*)：对不上的那一行 line_id 是 NULL，不会被数进去；COUNT(*) 会把它当成 1 行。',
            ],
          },
          {
            heading: '连接之前，先想清楚“一对多”',
            body: [
              '凭证头和分录是一对多：一张凭证会连出好几行。连接以后，凭证头上的每个值都会在每一行分录上重复出现。这时如果对“一”这边的金额求和，就会被重复加好几次。',
              '第 14 课会专门讲这个“连表后金额翻倍”的问题。现在先养成一个习惯：连接之后，数一数行数变了没有，想一想为什么变。',
            ],
          },
        ],
        askQuestions: [
          'JOIN、LEFT JOIN、RIGHT JOIN 有什么区别？实际工作中最常用哪个？',
          'VLOOKUP 找不到时返回 #N/A，LEFT JOIN 对不上时返回什么？后面计算时要注意什么？',
          '两张表按两个条件对上（比如月份和部门都要相同），ON 后面怎么写？',
        ],
        task: {
          prompt: '练习连表查询。参考答案在 answers.sql 第 7 课。',
          criteria: [
            '列出 2026-02-025 号凭证的所有分录，显示科目名称；有供应商的显示供应商名称（提示：供应商要用 LEFT JOIN）',
            '列出所有应收发票的发票号、客户名称和价税合计，按客户名称、发票号排序',
            '用 LEFT JOIN 列出全部 17 个科目各有几行分录，确认只有一个科目是 0',
            '结果和 answers.sql 的预期一致',
          ],
        },
        reflection: {
          question: '在第三条任务里，为什么用 JOIN 会“少”一个科目？什么情况下这种“少”是你想要的，什么情况下是错误？',
          answer: 'JOIN 只保留两边都对得上的行，1221 其他应收款在分录表里没有任何一行，所以被去掉了。如果你只关心“发生过业务的科目”，用 JOIN 正好；但如果要出一张完整的科目余额表，或者要确认“每个科目都检查过了”，少掉的科目就是遗漏，应该用 LEFT JOIN，并把 NULL 处理成 0。',
        },
        quiz: [
          {
            id: 'joins-q1',
            prompt: '如果某个客户一笔收款都没有，他会出现在下面这条查询的结果里吗？',
            code: `SELECT c.customer_name, COUNT(r.receipt_id) AS 收款次数
FROM customers c
LEFT JOIN ar_receipts r ON r.customer_id = c.customer_id
GROUP BY c.customer_name;`,
            options: ['会，收款次数显示 NULL', '会，收款次数显示 0', '不会，LEFT JOIN 会把他去掉'],
            answer: 1,
            explanation: 'LEFT JOIN 保留左边客户表的每一行；对不上的 r.receipt_id 是 NULL，COUNT(r.receipt_id) 不数 NULL，所以是 0。练习库里每个客户都有收款，这里是在问规则。',
          },
          {
            id: 'joins-q2',
            prompt: '用 JOIN（不是 LEFT JOIN）把科目表和分录行连起来，再按科目分组求和。结果里会不会有 1221 其他应收款？',
            options: ['不会，它没有分录，JOIN 对不上就去掉', '会，JOIN 会保留科目表的所有科目，金额显示 0', '会，金额是 NULL'],
            answer: 0,
            explanation: 'JOIN 是“两边都有才保留”。要把没有分录的科目也列出来，得用 LEFT JOIN。',
          },
          {
            id: 'joins-q3',
            prompt: '下面这条里的 v 和 l 是什么？',
            code: `SELECT v.voucher_no, l.debit
FROM vouchers v
JOIN voucher_lines l ON l.voucher_id = v.voucher_id
WHERE v.voucher_no = '2025-12-000' AND l.account_code = '1002';`,
            options: ['两张表的别名：v 是 vouchers，l 是 voucher_lines', '两张临时新建的表，查询结束后会自动删除', '两个列名，分别代表凭证号和借方金额', '两个筛选条件，用来限定凭证和分录的范围'],
            answer: 0,
            explanation: '写在表名后面的 v、l 是别名，后面用 v.列名、l.列名指明是哪张表的列。这条查的是期初余额凭证里银行存款的借方金额。',
          },
        ],
      },
    },

    // ------------------------------------------------------------ stage 3
    {
      id: 'vouchers-gl',
      stage: 'accounting',
      title: '凭证和总账：借贷平衡与科目余额表',
      summary: '找出借贷不平的凭证，做试算平衡，出一张科目余额表。',
      level: 2,
      dimensions: ['apply', 'read'],
      prereqs: ['joins', 'dates'],
      lesson: {
        sections: [
          {
            heading: '第一件事：检查每张凭证借贷平衡',
            body: [
              '有借必有贷，借贷必相等。按凭证分组，比较借方合计和贷方合计，就能找出不平的凭证：',
              { code: `SELECT v.voucher_no, v.voucher_date, v.description,
       SUM(l.debit) AS 借方合计, SUM(l.credit) AS 贷方合计
FROM vouchers v
JOIN voucher_lines l ON l.voucher_id = v.voucher_id
GROUP BY v.voucher_no, v.voucher_date, v.description
HAVING SUM(l.debit) <> SUM(l.credit);`,
                result: 'voucher_no\tvoucher_date\tdescription\t借方合计\t贷方合计\n2026-03-016\t2026-03-11\t购买打印纸、硒鼓\t1350.00\t1530.00' },
              '<> 是“不等于”。132 张凭证里只有这 1 张不平：2026-03-016 号，借方 1,350.00，贷方 1,530.00，差 180.00。差额能被 9 整除，是数字写颠倒（35 写成 53）的典型特征。实际工作中要找原始单据确认哪一边对，再做更正。',
            ],
          },
          {
            heading: '试算平衡：所有借方 = 所有贷方',
            body: [
              { code: `SELECT SUM(debit) AS 借方合计, SUM(credit) AS 贷方合计,
       SUM(debit) - SUM(credit) AS 差额
FROM voucher_lines;`,
                result: '借方合计\t贷方合计\t差额\n5750495.90\t5750675.90\t-180.00' },
              '差额是 -180.00，正好是那张凭证。把它排除后再算一次，差额是 0，说明其他凭证都是平的：',
              { code: `SELECT SUM(l.debit) AS 借方合计, SUM(l.credit) AS 贷方合计,
       SUM(l.debit) - SUM(l.credit) AS 差额
FROM voucher_lines l
JOIN vouchers v ON v.voucher_id = l.voucher_id
WHERE v.voucher_no <> '2026-03-016';`,
                result: '借方合计\t贷方合计\t差额\n5749145.90\t5749145.90\t0.00' },
            ],
          },
          {
            heading: '科目余额表：期初、本期发生、期末',
            body: [
              '科目余额表按科目列出期初余额、本期借方、本期贷方、期末余额。下面出 3 月的表：期初 = 3 月 1 日以前的所有分录（包括期初余额凭证），本期 = 3 月的分录。',
              '余额方向：资产、成本费用类科目余额一般在借方，余额 = 借 − 贷；负债、所有者权益、收入类在贷方，余额 = 贷 − 借。科目表的 balance_side 记着每个科目的方向。CASE WHEN 相当于 Excel 的 IF，这里用它按方向换算，让每个余额都以“正常方向为正数”显示：',
              { code: `SELECT a.account_code AS 科目代码, a.account_name AS 科目名称, a.balance_side AS 方向,
       SUM(CASE WHEN v.voucher_date < '2026-03-01' THEN l.debit - l.credit ELSE 0 END)
         * CASE WHEN a.balance_side = '借' THEN 1 ELSE -1 END AS 期初余额,
       SUM(CASE WHEN v.voucher_date >= '2026-03-01' THEN l.debit ELSE 0 END) AS 本期借方,
       SUM(CASE WHEN v.voucher_date >= '2026-03-01' THEN l.credit ELSE 0 END) AS 本期贷方,
       SUM(l.debit - l.credit)
         * CASE WHEN a.balance_side = '借' THEN 1 ELSE -1 END AS 期末余额
FROM accounts a
JOIN voucher_lines l ON l.account_code = a.account_code
JOIN vouchers v ON v.voucher_id = l.voucher_id
WHERE v.voucher_date < '2026-04-01'
GROUP BY a.account_code, a.account_name, a.balance_side
ORDER BY a.account_code;`,
                result: '科目代码\t科目名称\t方向\t期初余额\t本期借方\t本期贷方\t期末余额\n1001\t库存现金\t借\t3894.50\t0.00\t580.60\t3313.90\n1002\t银行存款\t借\t222731.70\t323492.40\t340451.10\t205773.00\n1122\t应收账款\t借\t576528.00\t409738.00\t323180.00\t663086.00\n1405\t库存商品\t借\t259712.00\t280000.00\t261072.00\t278640.00\n1601\t固定资产\t借\t120000.00\t0.00\t0.00\t120000.00\n1602\t累计折旧\t贷\t40000.00\t0.00\t2000.00\t42000.00\n2202\t应付账款\t贷\t342815.00\t275715.00\t333305.00\t400405.00\n2211\t应付职工薪酬\t贷\t44500.00\t44500.00\t46200.00\t46200.00\n2221\t应交税费\t贷\t728.00\t37128.00\t47138.00\t10738.00\n4001\t实收资本\t贷\t500000.00\t0.00\t0.00\t500000.00\n4104\t利润分配\t贷\t237900.00\t0.00\t0.00\t237900.00\n6001\t主营业务收入\t贷\t650400.00\t0.00\t362600.00\t1013000.00\n6401\t主营业务成本\t借\t468288.00\t261072.00\t0.00\t729360.00\n6601\t销售费用\t借\t89111.40\t46610.00\t0.00\t135721.40\n6602\t管理费用\t借\t75918.90\t38308.20\t0.00\t114227.10\n6603\t财务费用\t借\t158.50\t95.50\t312.40\t-58.40' },
              '怎么读：1602 累计折旧方向是贷，期末 42,000.00 是贷方余额；它是固定资产的备抵科目，出资产负债表时要从固定资产里减掉（第 11 课）。6603 财务费用方向是借，3 月收到的银行利息记在贷方，冲减了手续费，期末余额是负数，表示余额跑到了反方向。',
              '损益类科目（6001 以后）季度内没有结转，所以“期初余额”是 1–2 月累计的发生额。这张表包含那张不平的凭证，正式出表前要先把它查清、更正。',
              '还要注意：这里用的是 JOIN，一笔分录都没有的科目（比如 1221 其他应收款）不会出现在表里，这就是第 7 课讲的 JOIN 和 LEFT JOIN 的区别。要列出全部科目，就从 accounts 出发用 LEFT JOIN，再用 COALESCE 把空值显示成 0。',
            ],
          },
          {
            heading: '总账余额要能和外部对上',
            body: [
              '科目余额还要和外部证据核对，比如银行存款要和银行对账单核对。假设查了原始单据，3 月 11 日那笔打印纸、硒鼓实际付款是 1,350.00，那么账上的银行存款就少记了 180.00：',
              { code: `SELECT SUM(debit - credit) AS 账面银行存款
FROM voucher_lines
WHERE account_code = '1002';`,
                result: '账面银行存款\n205773.00' },
              '按这个假设，银行对账单上的余额会比账面多 180.00。像这样，凭证检查、试算平衡和外部对账是互相印证的。',
            ],
          },
        ],
        askQuestions: [
          '借贷不平的差额能被 9 整除，为什么常常是数字写颠倒？还有哪些常见的差错特征？',
          '科目余额表和试算平衡表是一回事吗？财务软件里一般怎么出这两张表？',
          '损益类科目在月末结转和不结转（账结法和表结法）时，科目余额表有什么不同？',
        ],
        task: {
          prompt: '在练习库里做总账检查。参考答案在 answers.sql 第 8 课。',
          criteria: [
            '运行借贷平衡检查，记下不平凭证的凭证号和差额',
            '出一张 2 月的科目余额表（期初 = 2 月 1 日以前，本期 = 2 月）',
            '核对：2 月表的期末余额和 3 月表的期初余额逐个科目一致',
            '排除那张不平的凭证后，确认借方合计等于贷方合计',
          ],
        },
        reflection: {
          question: '试算平衡了，是不是就说明账一定没错？举两个试算平衡但账仍然有错的例子。',
          answer: '不是。试算平衡只能证明借贷金额相等，有很多错误不影响平衡：比如科目用错（把管理费用记成销售费用，两边金额照样相等）、整张凭证重复记账（借贷都多记一份）、整张凭证漏记、金额借贷两边同时写错成同一个数。练习库里那张重复录入的应付发票就是例子：两张凭证各自平衡，试算也平衡，但应付账款多挂了一笔。所以还要做往来对账、和银行对账单核对、抽查原始单据。',
        },
        quiz: [
          {
            id: 'vouchers-gl-q1',
            prompt: '下面这条查询找的是什么？',
            code: `SELECT voucher_id, SUM(debit) - SUM(credit) AS 差额
FROM voucher_lines
GROUP BY voucher_id
HAVING SUM(debit) <> SUM(credit);`,
            options: ['金额最大的凭证，按借方合计排序', '借贷不平的凭证，及借贷差额', '没有摘要、需要补填说明的凭证', '重复录入的凭证，同一张出现了两次'],
            answer: 1,
            explanation: '按凭证分组，只留下借方合计不等于贷方合计的组。练习库里结果是一行：voucher_id 100（2026-03-016 号），差额 -180.00，负数表示贷方多。',
          },
          {
            id: 'vouchers-gl-q2',
            prompt: '应付账款 2202 是负债，余额方向在贷方。根据下面的结果，它的余额应该怎么说？',
            code: `SELECT SUM(debit) AS 借方合计, SUM(credit) AS 贷方合计
FROM voucher_lines
WHERE account_code = '2202';`,
            options: ['借方余额 400,405.00', '借方余额 1,959,155.00', '贷方余额 400,405.00'],
            answer: 2,
            explanation: '借方合计 779,375.00，贷方合计 1,179,780.00。贷方科目的余额 = 贷 − 借 = 400,405.00，是贷方余额，也就是还欠供应商 400,405.00。',
          },
          {
            id: 'vouchers-gl-q3',
            prompt: '1602 累计折旧在科目表里归为“资产”，余额方向却是“贷”。出资产负债表时应该怎么处理？',
            options: ['从固定资产原值中减去，得到净值', '当作负债列示，因为它的余额在贷方', '直接忽略'],
            answer: 0,
            explanation: '累计折旧是固定资产的备抵科目：固定资产净值 = 原值 − 累计折旧。它不是负债，也不能忽略。',
          },
        ],
      },
    },
    {
      id: 'ar-ap',
      stage: 'accounting',
      title: '应收应付：未核销发票、账龄与往来对账',
      summary: '算出每张发票还欠多少，做账龄分析，核对明细和总账，找出重复发票。',
      level: 2,
      dimensions: ['apply'],
      prereqs: ['vouchers-gl'],
      lesson: {
        sections: [
          {
            heading: '一张发票还欠多少：发票金额 − 已核销金额',
            body: [
              '应收发票表记的是开票金额；客户付了多少，记在核销表 ar_receipt_applications。一张发票可能被好几笔收款核销（分期付款），所以要先把核销金额按发票汇总，再连回发票表：',
              { code: `SELECT i.invoice_no, i.customer_id, i.invoice_date, i.total_amount,
       COALESCE(p.applied, 0) AS 已核销,
       i.total_amount - COALESCE(p.applied, 0) AS 未收金额
FROM ar_invoices i
LEFT JOIN (
  SELECT invoice_id, SUM(applied_amount) AS applied
  FROM ar_receipt_applications
  GROUP BY invoice_id
) p ON p.invoice_id = i.invoice_id
WHERE i.total_amount - COALESCE(p.applied, 0) > 0
ORDER BY i.invoice_date, i.invoice_no;`,
                result: 'invoice_no\tcustomer_id\tinvoice_date\ttotal_amount\t已核销\t未收金额\nXS-2511-021\tC004\t2025-11-20\t90400.00\t40000.00\t50400.00\nXS-2601-005\tC006\t2026-01-19\t47460.00\t27460.00\t20000.00\nXS-2601-009\tC004\t2026-01-30\t79100.00\t0.00\t79100.00\nXS-2602-004\tC002\t2026-02-13\t44748.00\t20000.00\t24748.00\nXS-2602-005\tC004\t2026-02-17\t58760.00\t0.00\t58760.00\nXS-2602-008\tC005\t2026-02-27\t22600.00\t0.00\t22600.00\nXS-2602-009\tC006\t2026-02-28\t20340.00\t0.00\t20340.00\nXS-2603-001\tC002\t2026-03-02\t51980.00\t0.00\t51980.00\nXS-2603-002\tC006\t2026-03-05\t39776.00\t0.00\t39776.00\nXS-2603-003\tC001\t2026-03-09\t66670.00\t0.00\t66670.00\nXS-2603-004\tC004\t2026-03-12\t67800.00\t0.00\t67800.00\nXS-2603-005\tC003\t2026-03-16\t22374.00\t0.00\t22374.00\nXS-2603-006\tC005\t2026-03-19\t22600.00\t0.00\t22600.00\nXS-2603-007\tC002\t2026-03-23\t35256.00\t0.00\t35256.00\nXS-2603-008\tC001\t2026-03-26\t59664.00\t0.00\t59664.00\nXS-2603-009\tC006\t2026-03-30\t28928.00\t0.00\t28928.00\nXS-2603-010\tC003\t2026-03-31\t14690.00\t0.00\t14690.00' },
              '括号里的查询叫子查询，先算出“每张发票核销了多少”，当成一张临时的表 p 再去连接。用 LEFT JOIN，是因为一分钱没收到的发票在核销表里没有记录。COALESCE(值, 0) 的意思是“如果是 NULL 就当 0”，不然没收过款的发票算出来是 NULL。',
            ],
          },
          {
            heading: '账龄分析',
            body: [
              '账龄从开票日算到截止日（这里用季度末 2026-03-31），分成 0–30 天、31–60 天、61–90 天、90 天以上四段。边界要写清楚：正好 30 天算第一段，31 天算第二段。',
              '“截至某一天”还意味着：只算这一天及以前开出的发票，只扣这一天及以前收到的款。练习数据到 3 月 31 日为止，加不加这两个条件结果一样；但真实账套里有 4 月的单据，不加就会算错。核销表本身没有日期，所以要连上收款表，用收款日期 receipt_date 来筛：',
              { code: `SELECT i.customer_id,
       SUM(CASE WHEN DATEDIFF('2026-03-31', i.invoice_date) <= 30
                THEN i.total_amount - COALESCE(p.applied, 0) ELSE 0 END) AS 账龄_0_30,
       SUM(CASE WHEN DATEDIFF('2026-03-31', i.invoice_date) BETWEEN 31 AND 60
                THEN i.total_amount - COALESCE(p.applied, 0) ELSE 0 END) AS 账龄_31_60,
       SUM(CASE WHEN DATEDIFF('2026-03-31', i.invoice_date) BETWEEN 61 AND 90
                THEN i.total_amount - COALESCE(p.applied, 0) ELSE 0 END) AS 账龄_61_90,
       SUM(CASE WHEN DATEDIFF('2026-03-31', i.invoice_date) > 90
                THEN i.total_amount - COALESCE(p.applied, 0) ELSE 0 END) AS 账龄_90以上,
       SUM(i.total_amount - COALESCE(p.applied, 0)) AS 合计
FROM ar_invoices i
LEFT JOIN (
  SELECT a.invoice_id, SUM(a.applied_amount) AS applied
  FROM ar_receipt_applications a
  JOIN ar_receipts r ON r.receipt_id = a.receipt_id
  WHERE r.receipt_date <= '2026-03-31'
  GROUP BY a.invoice_id
) p ON p.invoice_id = i.invoice_id
WHERE i.invoice_date <= '2026-03-31'
GROUP BY i.customer_id
ORDER BY i.customer_id;`,
                result: 'customer_id\t账龄_0_30\t账龄_31_60\t账龄_61_90\t账龄_90以上\t合计\nC001\t126334.00\t0.00\t0.00\t0.00\t126334.00\nC002\t87236.00\t24748.00\t0.00\t0.00\t111984.00\nC003\t37064.00\t0.00\t0.00\t0.00\t37064.00\nC004\t67800.00\t137860.00\t0.00\t50400.00\t256060.00\nC005\t22600.00\t22600.00\t0.00\t0.00\t45200.00\nC006\t68704.00\t20340.00\t20000.00\t0.00\t109044.00' },
              '读结果：西岭连锁书店（C004）有 50,400.00 在 90 天以上，是 2025 年 11 月的发票只收回了一部分，应该优先催收。北辰科技（C001）和南山设计（C003）的欠款都在 30 天以内。',
              '注意青松物业（C005）这一行：它 3 月 27 日付来的 22,600.00 还没有核销到任何发票上，账龄表只认核销记录，所以这笔钱没有被扣掉，45,200.00 比它实际欠的多。这也是下一段明细和总账对不上的原因，第 14 课会讲怎么查出来、怎么对平。',
              '还有一种口径叫逾期分析：按到期日 due_date 算超过了几天。两种都常用，报数时要说清楚用的是哪个。',
            ],
          },
          {
            heading: '往来对账：明细合计要和总账对得上',
            body: [
              '所有未收发票加起来，应该等于总账 1122 应收账款的余额。各算一个数：',
              { code: `SELECT SUM(i.total_amount - COALESCE(p.applied, 0)) AS 未收发票合计
FROM ar_invoices i
LEFT JOIN (
  SELECT invoice_id, SUM(applied_amount) AS applied
  FROM ar_receipt_applications
  GROUP BY invoice_id
) p ON p.invoice_id = i.invoice_id;`,
                result: '未收发票合计\n685686.00' },
              { code: `SELECT SUM(debit - credit) AS 总账应收余额
FROM voucher_lines
WHERE account_code = '1122';`,
                result: '总账应收余额\n663086.00' },
              '两个数差 22,600.00，对不上。差额从哪来，第 14 课会一步步查出来。先记住：明细和总账对不上时，不要直接改数，要先找到原因。',
            ],
          },
          {
            heading: '应付：小心重复发票',
            body: [
              '同一张供应商发票被录入两次，最大的风险是付两次款。按“供应商 + 发票号”分组数一数：',
              { code: `SELECT vendor_id, invoice_no, COUNT(*) AS 录入次数, SUM(total_amount) AS 合计金额
FROM ap_invoices
GROUP BY vendor_id, invoice_no
HAVING COUNT(*) > 1;`,
                result: 'vendor_id\tinvoice_no\t录入次数\t合计金额\nS002\t04418827\t2\t158200.00' },
              '恒达笔业（S002）的 04418827 号发票被录了两次（2 月 16 日和 2 月 18 日两张凭证），两次都记了账：库存商品和进项税多记了一份，应付账款也多挂了 79,100.00。3 月 30 日已经付过其中一张，另一张还显示未付，如果不查出来，就可能再付一次。处理办法是核实后冲销多录的那张凭证。',
              '进项税也一样：实际工作中，同一张增值税专用发票在税务系统里只能勾选认证、抵扣一次，账上却记了两份进项税，2221 应交税费的账面数就和税务申报对不上了，这也是重复录入要纠正的内容。',
              '要用“供应商 + 发票号”一起分组，因为不同供应商的发票号可能碰巧相同。',
            ],
          },
        ],
        askQuestions: [
          '账龄按开票日算和按到期日算（逾期分析），各适合什么场景？坏账准备一般按哪个？',
          '客户预付款或者多付的钱，在应收账龄表里应该怎么体现？',
          '除了“供应商 + 发票号”完全相同，还有哪些重复付款的迹象值得用 SQL 筛查？',
        ],
        task: {
          prompt: '做应付这一边的分析。参考答案在 answers.sql 第 9 课。',
          criteria: [
            '列出所有没付清的应付发票：供应商名称、发票号、发票日期、未付金额',
            '做一张按供应商的应付账龄表（截至 2026-03-31，按发票日期，四段）',
            '核对：未付应付发票合计 = 总账 2202 应付账款贷方余额（400,405.00）',
            '找出重复录入的应付发票，写一句处理建议',
          ],
        },
        reflection: {
          question: '为什么算“未收金额”时要先把核销表按发票汇总，再连接发票表？直接把发票表和核销表连起来求和会怎样？',
          answer: '因为一张发票可能对应多行核销记录（分期付款）。如果直接连接，再对发票金额求和，这张发票的金额会按核销行数重复计算，未收金额就算错了。先把核销表汇总成“每张发票一行”，连接就是一对一，发票金额只出现一次。另外还要用 LEFT JOIN 和 COALESCE，保证一分钱没收到的发票不会被漏掉，也不会算成 NULL。',
        },
        quiz: [
          {
            id: 'ar-ap-q1',
            prompt: 'XS-2603-001 还没收到任何款。下面这条查询的“未收金额”会显示什么？',
            code: `SELECT i.invoice_no, i.total_amount - p.applied AS 未收金额
FROM ar_invoices i
LEFT JOIN (
  SELECT invoice_id, SUM(applied_amount) AS applied
  FROM ar_receipt_applications
  GROUP BY invoice_id
) p ON p.invoice_id = i.invoice_id
WHERE i.invoice_no = 'XS-2603-001';`,
            options: ['51,980.00，LEFT JOIN 会自动把没有的核销金额当 0', '0.00', 'NULL，因为 NULL 参与减法结果是 NULL'],
            answer: 2,
            explanation: '这就是为什么要写 COALESCE(p.applied, 0)。漏掉它，所有没收过款的发票都会显示 NULL，求和时也会被跳过，未收合计就少了。',
          },
          {
            id: 'ar-ap-q2',
            prompt: '账龄截至 2026-03-31。2026-03-01 开出的发票，账龄是多少天，落在哪一段？',
            code: `SELECT DATEDIFF('2026-03-31', '2026-03-01') AS 天数;`,
            options: ['31 天，落在 31–60 天', '30 天，落在 0–30 天', '29 天，落在 0–30 天'],
            answer: 1,
            explanation: '3 月 31 日减 3 月 1 日是 30 天。按“<= 30 算第一段”的规则，它在 0–30 天。边界那一天算哪段，要在口径里写清楚。',
          },
          {
            id: 'ar-ap-q3',
            prompt: '查重复的应付发票时，为什么要按“供应商 + 发票号”一起分组，而不是只按发票号？',
            options: ['只按发票号分组，MySQL 会报错说缺少列', '不同供应商的发票号可能相同，会被误判为重复', '按供应商一起分组，查询会更快、更省内存'],
            answer: 1,
            explanation: '发票号只在同一个开票方内部唯一。两家供应商都可能有 00000123 号发票，那不是重复。',
          },
        ],
      },
    },
    {
      id: 'expenses',
      stage: 'accounting',
      title: '费用和成本：按部门、月份汇总，对比预算',
      summary: '按部门和月份汇总期间费用，和预算比较，看毛利率。',
      level: 2,
      dimensions: ['apply'],
      prereqs: ['joins', 'dates'],
      lesson: {
        sections: [
          {
            heading: '费用在哪里：损益类、看借方、带部门',
            body: [
              '练习库的期间费用记在 6601 销售费用、6602 管理费用、6603 财务费用，分录上带部门。费用的发生额 = 借方 − 贷方，贷方一般是冲减，比如财务费用里的利息收入。',
              'IN (…) 的意思是“等于括号里任意一个”，比写一串 OR 简洁：',
              { code: `SELECT d.dept_name AS 部门, l.account_code AS 科目,
       DATE_FORMAT(v.voucher_date, '%Y-%m') AS 月份,
       SUM(l.debit - l.credit) AS 发生额
FROM voucher_lines l
JOIN vouchers v ON v.voucher_id = l.voucher_id
JOIN departments d ON d.dept_id = l.dept_id
WHERE l.account_code IN ('6601', '6602', '6603')
GROUP BY d.dept_id, d.dept_name, l.account_code, 月份
ORDER BY d.dept_id, l.account_code, 月份;`,
                result: '部门\t科目\t月份\t发生额\n管理部\t6602\t2026-01\t29760.60\n管理部\t6602\t2026-02\t29657.70\n管理部\t6602\t2026-03\t30996.70\n销售部\t6601\t2026-01\t27357.20\n销售部\t6601\t2026-02\t34495.60\n销售部\t6601\t2026-03\t30571.30\n仓储物流部\t6601\t2026-01\t13880.70\n仓储物流部\t6601\t2026-02\t13377.90\n仓储物流部\t6601\t2026-03\t16038.70\n财务部\t6602\t2026-01\t9165.40\n财务部\t6602\t2026-02\t7335.20\n财务部\t6602\t2026-03\t7311.50\n财务部\t6603\t2026-01\t86.50\n财务部\t6603\t2026-02\t72.00\n财务部\t6603\t2026-03\t-216.90' },
            ],
          },
          {
            heading: '和预算对比',
            body: [
              '预算表 budgets 每个“月份 + 部门 + 科目”一行。先把实际发生额汇总到同样的粒度，再和预算连接：',
              { code: `SELECT b.dept_id AS 部门, b.account_code AS 科目,
       b.amount AS 预算,
       COALESCE(x.actual, 0) AS 实际,
       COALESCE(x.actual, 0) - b.amount AS 差异
FROM budgets b
LEFT JOIN (
  SELECT DATE_FORMAT(v.voucher_date, '%Y-%m') AS ym, l.dept_id, l.account_code,
         SUM(l.debit - l.credit) AS actual
  FROM voucher_lines l
  JOIN vouchers v ON v.voucher_id = l.voucher_id
  WHERE l.account_code IN ('6601', '6602', '6603')
  GROUP BY ym, l.dept_id, l.account_code
) x ON x.ym = b.budget_month AND x.dept_id = b.dept_id AND x.account_code = b.account_code
WHERE b.budget_month = '2026-03'
ORDER BY b.dept_id, b.account_code;`,
                result: '部门\t科目\t预算\t实际\t差异\nD01\t6602\t30100.00\t30996.70\t896.70\nD02\t6601\t29000.00\t30571.30\t1571.30\nD03\t6601\t14900.00\t16038.70\t1138.70\nD03\t6602\t500.00\t0.00\t-500.00\nD04\t6602\t10000.00\t7311.50\t-2688.50\nD04\t6603\t100.00\t-216.90\t-316.90' },
              '差异为正表示超支。D03 仓储物流部的 6602 管理费用有预算、没有实际发生，用 LEFT JOIN 才不会把它漏掉，COALESCE 再把 NULL 变成 0。',
            ],
          },
          {
            heading: '先汇总，再连接',
            body: [
              '为什么不直接把预算表和分录行连起来再求和？因为一个“月份 + 部门 + 科目”对应很多行分录，直接连接后，同一个预算金额会出现在每一行分录旁边，SUM 就把预算加了好多次：',
              { code: `SELECT b.dept_id, b.account_code,
       SUM(b.amount) AS 预算_错误,
       SUM(l.debit - l.credit) AS 实际
FROM budgets b
JOIN voucher_lines l ON l.dept_id = b.dept_id AND l.account_code = b.account_code
JOIN vouchers v ON v.voucher_id = l.voucher_id
  AND DATE_FORMAT(v.voucher_date, '%Y-%m') = b.budget_month
WHERE b.budget_month = '2026-03'
GROUP BY b.dept_id, b.account_code
ORDER BY b.dept_id, b.account_code;`,
                result: 'dept_id\taccount_code\t预算_错误\t实际\nD01\t6602\t210700.00\t30996.70\nD02\t6601\t174000.00\t30571.30\nD03\t6601\t74500.00\t16038.70\nD04\t6602\t20000.00\t7311.50\nD04\t6603\t200.00\t-216.90' },
              '和上一段对比：实际数一样，预算却被放大了好几倍；没有实际发生的那条预算也不见了。先把分录汇总到和预算一样的粒度，再一对一连接，就不会出这种错。',
            ],
          },
          {
            heading: '成本和毛利率',
            body: [
              '这家公司每月末按销售额的一定比例结转主营业务成本（6401）。按月看收入、成本和毛利率：',
              { code: `SELECT DATE_FORMAT(v.voucher_date, '%Y-%m') AS 月份,
       SUM(CASE WHEN l.account_code = '6001' THEN l.credit - l.debit ELSE 0 END) AS 收入,
       SUM(CASE WHEN l.account_code = '6401' THEN l.debit - l.credit ELSE 0 END) AS 成本,
       ROUND(1 - SUM(CASE WHEN l.account_code = '6401' THEN l.debit - l.credit ELSE 0 END)
               / SUM(CASE WHEN l.account_code = '6001' THEN l.credit - l.debit ELSE 0 END), 4) AS 毛利率
FROM voucher_lines l
JOIN vouchers v ON v.voucher_id = l.voucher_id
WHERE v.voucher_date >= '2026-01-01'
GROUP BY 月份
ORDER BY 月份;`,
                result: '月份\t收入\t成本\t毛利率\n2026-01\t344800.00\t248256.00\t0.2800\n2026-02\t305600.00\t220032.00\t0.2800\n2026-03\t362600.00\t261072.00\t0.2800' },
              '毛利率 = 1 − 成本 ÷ 收入。ROUND(…, 4) 保留 4 位小数，0.2800 就是 28%。',
            ],
          },
        ],
        askQuestions: [
          '预算对比时，差异用“实际 − 预算”还是“预算 − 实际”？报告里怎么约定正负号不容易误解？',
          '有些费用是按季度或年度预算的，怎么和按月的实际数对比？',
          '除了部门，费用还常按项目、成本中心归集。如果分录上有项目字段，SQL 要怎么改？',
        ],
        task: {
          prompt: '做一份费用分析。参考答案在 answers.sql 第 10 课。',
          criteria: [
            '按部门汇总 1–3 月三项期间费用的合计，找出花得最多的部门',
            '出一张 1–3 月累计的预算对比表（按部门 + 科目），标出超支的项目',
            '找出 3 月金额最大的 5 笔费用分录，显示凭证号、摘要、部门和金额',
            '结果和 answers.sql 的预期一致',
          ],
        },
        reflection: {
          question: '用“预算_错误”那条查询的结果给领导汇报，会得出什么错误结论？你会怎么发现它错了？',
          answer: '预算被放大了好几倍，几乎每个部门看起来都大幅节约，领导可能据此削减下期预算或表扬控制得好，结论完全是假的。发现的办法：拿预算表直接按部门汇总一次，和查询结果里的预算比，数对不上就说明连接把预算重复了；另外，看到“每个部门都只花了预算的一小部分”这种好得不正常的结果，也要先怀疑查询。',
        },
        quiz: [
          {
            id: 'expenses-q1',
            prompt: '下面这条查询里“预算”一列为什么比预算表里的数大得多？',
            code: `SELECT b.dept_id, SUM(b.amount) AS 预算
FROM budgets b
JOIN voucher_lines l ON l.dept_id = b.dept_id AND l.account_code = b.account_code
WHERE b.budget_month = '2026-01'
GROUP BY b.dept_id
ORDER BY b.dept_id;`,
            options: ['预算表录错了，每个月的预算都多录了好几次', '一行预算连上多行分录，被加了很多次', 'DATE_FORMAT 把月份算错了，连上了别的月份的预算', '应该用 RIGHT JOIN，才能保留所有分录行'],
            answer: 1,
            explanation: '每个“部门 + 科目”的预算会和这个部门这个科目的每一行分录配对一次（这条连月份都没限制，配得更多）。先汇总分录、再连接预算才对。',
          },
          {
            id: 'expenses-q2',
            prompt: '财务部 3 月的 6603 财务费用发生额是负数。最可能的原因是？',
            options: ['数据录错了', '财务费用不允许有发生额，应该全部转入管理费用', '利息收入记在贷方，冲减后比手续费多'],
            answer: 2,
            explanation: '利息收入按惯例冲减财务费用，记在贷方。当月利息比手续费多，发生额（借 − 贷）就是负数，这是正常的。',
          },
        ],
      },
    },
    {
      id: 'statements',
      stage: 'accounting',
      title: '出报表：利润表和资产负债表的数字',
      summary: '从明细汇总出利润表和资产负债表，核对“资产 = 负债 + 所有者权益 + 本期利润”。',
      level: 2,
      dimensions: ['apply'],
      prereqs: ['vouchers-gl'],
      lesson: {
        sections: [
          {
            heading: '利润表：一段时间的损益类发生额',
            body: [
              '利润表看一段时间赚了多少，数字来自损益类科目在这段时间的发生额：收入看贷方 − 借方，成本费用看借方 − 贷方。练习库季度内没有把损益结转到“本年利润”（表结法），所以直接汇总损益类科目就行。',
              { code: `SELECT a.account_code AS 科目代码, a.account_name AS 项目,
       SUM(CASE WHEN a.balance_side = '贷' THEN l.credit - l.debit
                ELSE l.debit - l.credit END) AS 本季发生额
FROM voucher_lines l
JOIN vouchers v ON v.voucher_id = l.voucher_id
JOIN accounts a ON a.account_code = l.account_code
WHERE a.category = '损益'
  AND v.voucher_date >= '2026-01-01' AND v.voucher_date < '2026-04-01'
GROUP BY a.account_code, a.account_name
ORDER BY a.account_code;`,
                result: '科目代码\t项目\t本季发生额\n6001\t主营业务收入\t1013000.00\n6401\t主营业务成本\t729360.00\n6601\t销售费用\t135721.40\n6602\t管理费用\t114227.10\n6603\t财务费用\t-58.40' },
              '利润 = 收入 − 成本 − 费用。因为收入在贷方、成本费用在借方，用一个“贷 − 借”的合计就能一次算出来：',
              { code: `SELECT SUM(l.credit - l.debit) AS 利润总额
FROM voucher_lines l
JOIN vouchers v ON v.voucher_id = l.voucher_id
JOIN accounts a ON a.account_code = l.account_code
WHERE a.category = '损益'
  AND v.voucher_date >= '2026-01-01' AND v.voucher_date < '2026-04-01';`,
                result: '利润总额\n33749.90' },
              '练习库没有计提所得税，所以这里叫“利润总额”，不是净利润。',
            ],
          },
          {
            heading: '资产负债表：某一天的累计余额',
            body: [
              '资产负债表看某一天（这里是 2026-03-31）的状况，用的是资产、负债、所有者权益类科目从开账到这一天的累计余额，包括期初余额凭证。',
              { code: `SELECT a.category AS 类别,
       SUM(CASE WHEN a.category = '资产' THEN l.debit - l.credit
                ELSE l.credit - l.debit END) AS 期末余额
FROM voucher_lines l
JOIN vouchers v ON v.voucher_id = l.voucher_id
JOIN accounts a ON a.account_code = l.account_code
WHERE a.category IN ('资产', '负债', '所有者权益')
  AND v.voucher_date <= '2026-03-31'
GROUP BY a.category
ORDER BY FIELD(a.category, '资产', '负债', '所有者权益');`,
                result: '类别\t期末余额\n资产\t1228812.90\n负债\t457343.00\n所有者权益\t737900.00' },
              '注意这里按“类别”而不是按“余额方向”取正负：资产类一律用借 − 贷。1602 累计折旧属于资产类、余额在贷方，算出来是负数，正好从资产里减掉。要是按余额方向把它变成正数再加进资产，资产就多算了两倍的累计折旧。',
            ],
          },
          {
            heading: '资产 = 负债 + 所有者权益 + 本期利润',
            body: [
              '季度内损益没有结转，本期利润还留在损益类科目里，所以平衡关系是：资产 = 负债 + 所有者权益 + 本期利润。一条查询把四个数都算出来：',
              { code: `SELECT SUM(CASE WHEN a.category = '资产' THEN l.debit - l.credit ELSE 0 END) AS 资产,
       SUM(CASE WHEN a.category = '负债' THEN l.credit - l.debit ELSE 0 END) AS 负债,
       SUM(CASE WHEN a.category = '所有者权益' THEN l.credit - l.debit ELSE 0 END) AS 所有者权益,
       SUM(CASE WHEN a.category = '损益' THEN l.credit - l.debit ELSE 0 END) AS 本期利润
FROM voucher_lines l
JOIN accounts a ON a.account_code = l.account_code;`,
                result: '资产\t负债\t所有者权益\t本期利润\n1228812.90\t457343.00\t737900.00\t33749.90' },
              '右边三项加起来是 1,228,992.90，比资产多 180.00，还是第 8 课那张不平的凭证（贷方多记了 180.00 银行存款）。凭证更正以后，报表自然就平了。报表不平时，要回头查凭证，而不是在报表上“调平”。',
            ],
          },
          {
            heading: '报表项目不等于科目',
            body: [
              '正式报表的项目往往由几个科目组成：“货币资金”= 库存现金 + 银行存款；“固定资产”= 固定资产原值 − 累计折旧；“应交税费”有时还要按余额方向重分类。',
              { code: `SELECT SUM(debit - credit) AS 货币资金
FROM voucher_lines
WHERE account_code IN ('1001', '1002');`,
                result: '货币资金\n209086.90' },
              '写 SQL 之前，先把“每个报表项目由哪些科目组成”列成一张对照表，再按对照表汇总，比在查询里硬写一长串科目代码更不容易错，也方便别人复核。',
            ],
          },
        ],
        askQuestions: [
          '账结法和表结法下，用 SQL 取利润表的数有什么不同？',
          '“应交税费”期末是借方余额时，资产负债表上应该怎么列示？',
          '怎样用 SQL 做一张“报表项目—科目”对照表，再按它出整张资产负债表？',
        ],
        task: {
          prompt: '从练习库取报表数。参考答案在 answers.sql 第 11 课。',
          criteria: [
            '出 2026 年 1 月的利润表：各损益科目发生额和利润总额',
            '出 2026-02-28 的资产、负债、所有者权益余额和 1–2 月利润，确认 资产 = 负债 + 所有者权益 + 本期利润（2 月末应该正好平衡）',
            '算出 2026-03-31 的固定资产净值',
            '结果和 answers.sql 的预期一致',
          ],
        },
        reflection: {
          question: '为什么 2 月末的资产负债表是平的，3 月末却差 180.00？这说明了什么？',
          answer: '因为那张借贷不平的凭证日期是 3 月 11 日，2 月末之前的凭证全部平衡，所以 2 月末的报表正好平衡；3 月末的余额包含了这张凭证，贷方多出的 180.00 让资产少了 180.00，右边却没有对应的减少。这说明报表平不平衡，归根到底取决于凭证；报表的差额往往能直接指向出错的期间和金额，查错时可以先按月缩小范围。',
        },
        quiz: [
          {
            id: 'statements-q1',
            prompt: '利润表和资产负债表取数的区别是？',
            options: ['两者都看一段时间的发生额，只是汇总的科目不同', '利润表看期间发生额，资产负债表看时点余额', '两者都看某一天的余额，只是选的日期不同', '利润表只看借方发生额，资产负债表只看贷方余额'],
            answer: 1,
            explanation: '利润表是“期间”报表，资产负债表是“时点”报表。所以利润表的查询要限定起止日期，资产负债表要从开账累计到截止日。',
          },
          {
            id: 'statements-q2',
            prompt: 'AI 写了下面这条查询算资产合计，结果是 1,312,812.90，比正确的数多了 84,000.00。问题在哪？',
            code: `SELECT SUM(CASE WHEN a.balance_side = '借' THEN l.debit - l.credit
                ELSE l.credit - l.debit END) AS 资产合计
FROM voucher_lines l
JOIN accounts a ON a.account_code = l.account_code
WHERE a.category = '资产';`,
            options: ['应该用 LEFT JOIN，否则没有分录的资产科目会被漏掉', '累计折旧被按余额方向变成正数，加进了资产', '没有限定日期，把 4 月以后的数据也算进来了', '应该按月分组，否则各月的数会互相抵消'],
            answer: 1,
            explanation: '累计折旧余额 42,000.00 在贷方。资产类应统一用借 − 贷，它就是 -42,000.00；这条却把它算成 +42,000.00，差了 84,000.00。',
          },
          {
            id: 'statements-q3',
            prompt: '季度中间核对资产负债表时，为什么要把本期利润加到右边？',
            options: ['因为本期利润一定是正数，加上去右边才够大', '因为本期利润属于负债，要和其他负债一起列示', '损益还没结转，利润还留在损益类科目里'],
            answer: 2,
            explanation: '采用表结法时，损益类科目平时不结转，期末才转入未分配利润。季度中间，所有者权益科目里还不包含本期利润，要单独加上。',
          },
        ],
      },
    },

    // ------------------------------------------------------------ stage 4
    {
      id: 'read-complex',
      stage: 'ai',
      title: '读懂复杂 SQL：子查询、分步查询、排名和累计',
      summary: 'AI 写的长查询常见的几种结构：子查询、WITH、RANK、累计求和。',
      level: 3,
      dimensions: ['read', 'ai'],
      prereqs: ['ar-ap'],
      lesson: {
        sections: [
          {
            heading: '子查询：查询里套查询',
            body: [
              '读带子查询的 SQL，从最里面一层读起。下面这条的里层先找出“3 月开过 6 万元以上发票的客户编号”，外层再按这些编号取客户名称：',
              { code: `SELECT customer_id, customer_name
FROM customers
WHERE customer_id IN (
  SELECT customer_id
  FROM ar_invoices
  WHERE invoice_date >= '2026-03-01' AND total_amount >= 60000
)
ORDER BY customer_id;`,
                result: 'customer_id\tcustomer_name\nC001\t北辰科技有限公司\nC004\t西岭连锁书店' },
            ],
          },
          {
            heading: 'WITH：把查询拆成几步',
            body: [
              'AI 写的长查询常用 WITH 开头，给中间结果起个名字，就像在 Excel 里先用辅助列算好，再引用辅助列。读的时候一步一步看：',
              { code: `WITH applied AS (
  SELECT invoice_id, SUM(applied_amount) AS applied
  FROM ar_receipt_applications
  GROUP BY invoice_id
),
open_items AS (
  SELECT i.customer_id, i.total_amount - COALESCE(a.applied, 0) AS open_amount
  FROM ar_invoices i
  LEFT JOIN applied a ON a.invoice_id = i.invoice_id
)
SELECT c.customer_name, SUM(o.open_amount) AS 未收合计
FROM open_items o
JOIN customers c ON c.customer_id = o.customer_id
GROUP BY c.customer_name
ORDER BY 未收合计 DESC;`,
                result: 'customer_name\t未收合计\n西岭连锁书店\t256060.00\n北辰科技有限公司\t126334.00\n东湖教育培训中心\t111984.00\n海棠酒店管理有限公司\t109044.00\n青松物业管理有限公司\t45200.00\n南山设计工作室\t37064.00' },
              '第一步 applied：每张发票核销了多少；第二步 open_items：每张发票还欠多少；最后按客户汇总。每一步都可以单独拿出来运行，检查中间结果。',
            ],
          },
          {
            heading: '排名：RANK() OVER',
            body: [
              '窗口函数可以在不合并行的情况下做排名、累计。RANK() OVER (ORDER BY …) 就是按括号里的顺序排名次：',
              { code: `SELECT customer_id,
       SUM(net_amount) AS 不含税销售额,
       RANK() OVER (ORDER BY SUM(net_amount) DESC) AS 名次
FROM ar_invoices
WHERE invoice_date >= '2026-01-01'
GROUP BY customer_id
ORDER BY 名次;`,
                result: 'customer_id\t不含税销售额\t名次\nC001\t308400.00\t1\nC002\t201800.00\t2\nC004\t182000.00\t3\nC006\t143200.00\t4\nC005\t93000.00\t5\nC003\t84600.00\t6' },
              '金额相同时，RANK 给出相同的名次，下一个名次会跳过（比如两个第 2 名，接下来是第 4 名）。',
            ],
          },
          {
            heading: '累计：SUM() OVER',
            body: [
              '累计数（像银行日记账里的余额列）用 SUM(…) OVER (ORDER BY …)。下面先在子查询里算出每月银行存款的净流入，外层再累计：',
              { code: `SELECT 月份, 本月净额,
       SUM(本月净额) OVER (ORDER BY 月份) AS 累计余额
FROM (
  SELECT DATE_FORMAT(v.voucher_date, '%Y-%m') AS 月份,
         SUM(l.debit - l.credit) AS 本月净额
  FROM voucher_lines l
  JOIN vouchers v ON v.voucher_id = l.voucher_id
  WHERE l.account_code = '1002'
  GROUP BY 月份
) m
ORDER BY 月份;`,
                result: '月份\t本月净额\t累计余额\n2025-12\t486500.00\t486500.00\n2026-01\t-134034.10\t352465.90\n2026-02\t-129734.20\t222731.70\n2026-03\t-16958.70\t205773.00' },
              '第一行 2025-12 是期初余额凭证，累计到 2026-03 就是银行存款的账面余额（含第 8 课那张不平凭证的影响）。',
            ],
          },
        ],
        askQuestions: [
          '子查询、WITH 和临时表有什么区别？什么时候用哪个？',
          'RANK、DENSE_RANK、ROW_NUMBER 有什么不同？做“每个客户金额最大的一张发票”该用哪个？',
          '窗口函数里的 PARTITION BY 是什么意思？举一个会计上的例子。',
        ],
        task: {
          prompt: '读懂并改写复杂查询。参考答案在 answers.sql 第 12 课。',
          criteria: [
            '把本节 WITH 查询的前两步分别单独运行，看懂中间结果',
            '按供应商给 2026 年的采购额（不含税）排名',
            '算出库存现金（1001）按月的累计余额',
            '结果和 answers.sql 的预期一致',
          ],
        },
        reflection: {
          question: '拿到一条 AI 写的、几十行长的 SQL，你会按什么顺序去读懂它？',
          answer: '先看最后的 SELECT 输出哪些列、按什么分组排序，知道它“想交出什么”；再看 FROM 和 JOIN，弄清用了哪些表、按什么条件连接、有没有一对多；然后看 WHERE 的筛选和日期边界；有子查询或 WITH 的，从最里面、最前面一步读起，每一步单独运行看结果。读不懂的地方，让 AI 用中文逐段解释，并说明每一步大概会返回多少行。',
        },
        quiz: [
          {
            id: 'read-complex-q1',
            prompt: '下面这条查询最终返回什么？',
            code: `WITH monthly AS (
  SELECT DATE_FORMAT(invoice_date, '%Y-%m') AS ym, SUM(net_amount) AS sales
  FROM ar_invoices
  WHERE invoice_date >= '2026-01-01'
  GROUP BY ym
)
SELECT ym, sales
FROM monthly
WHERE sales = (SELECT MAX(sales) FROM monthly);`,
            options: ['每个月的销售额，按月份排序', '销售额最高的那一张发票和它的金额', '销售额最高的那个月及其金额', '销售额最高的客户，以及这个客户的合计'],
            answer: 2,
            explanation: '第一步按月汇总不含税销售额；最后一步只保留等于最大值的那一个月。结果是 2026-03，362,600.00。',
          },
          {
            id: 'read-complex-q2',
            prompt: '两个客户的销售额完全相同，并列第 2。用 RANK() 排名，下一个客户是第几名？',
            options: ['第 3 名', '第 4 名', '也是第 2 名'],
            answer: 1,
            explanation: 'RANK 遇到并列时给相同名次，并跳过被占用的名次：1、2、2、4。不想跳号用 DENSE_RANK：1、2、2、3。',
          },
          {
            id: 'read-complex-q3',
            prompt: '本节“累计余额”那条查询里，2026-02 那一行的累计余额代表什么？',
            options: ['截至 2 月末的银行存款余额', '2 月一个月的净流入，也就是 2 月收入减支出', '1 月和 2 月余额的平均数，用来看趋势'],
            answer: 0,
            explanation: 'SUM() OVER (ORDER BY 月份) 把从第一行（2025-12 期初）到当前月的净额全部加起来，就是到这个月末为止的余额。',
          },
        ],
      },
    },
    {
      id: 'prompt-ai',
      stage: 'ai',
      title: '怎么向 AI 提需求：给表结构、说清口径',
      summary: '让 AI 知道你的表长什么样、数要怎么算，并让它解释每一步。',
      level: 3,
      dimensions: ['ai'],
      prereqs: ['read-complex'],
      lesson: {
        sections: [
          {
            heading: 'AI 不知道你的表长什么样',
            body: [
              '同样一句“帮我算一下应收账龄”，AI 不知道你的表叫什么、列叫什么、核销记在哪，只能猜。猜错的 SQL 有时会报错，更危险的是能运行、但算错了。第一步是把表结构告诉它。',
              'information_schema 是 MySQL 自带的“说明书”，能查出每张表有哪些列、什么类型、注释写了什么：',
              { code: `SELECT column_name AS 列名, data_type AS 类型, column_comment AS 说明
FROM information_schema.columns
WHERE table_schema = 'acct_practice' AND table_name = 'ar_invoices'
ORDER BY ordinal_position;`,
                result: '列名\t类型\t说明\ninvoice_id\tint\t应收发票内部编号\ninvoice_no\tvarchar\t发票号\ncustomer_id\tvarchar\t客户\ninvoice_date\tdate\t开票日期\ndue_date\tdate\t到期日 = 开票日期 + 信用期\nnet_amount\tdecimal\t不含税金额\ntax_amount\tdecimal\t税额\ntotal_amount\tdecimal\t价税合计（应收金额）\nvoucher_id\tint\t记账凭证' },
              '也可以用下面这条得到完整的建表语句，里面有列、类型、主键和表之间的关系：',
              { code: `SHOW CREATE TABLE ar_receipt_applications;` },
              '把这些结构复制给 AI，只给结构，不给真实数据。',
            ],
          },
          {
            heading: '说清口径',
            body: [
              '口径就是“这个数到底怎么算”。会计最清楚口径，AI 最不清楚。提需求时至少说清这五件事：1）时间范围和截止日；2）金额含不含税；3）按哪个日期算（开票日、到期日、凭证日期）；4）包括哪些、排除哪些（比如期初余额凭证、作废单据）；5）结果要哪些列、怎么排序、要不要合计行。',
              '一个例子：“请写 MySQL 查询。截至 2026-03-31，按客户统计应收账款账龄。未收金额 = 发票价税合计 total_amount − 核销表 ar_receipt_applications 里这张发票的核销合计。账龄按开票日计算，分 0–30、31–60、61–90、90 天以上四段，正好 30 天算第一段。截止日写成固定日期，不要用 CURDATE()；只算截止日及以前开出的发票和收到的款。只列有未收金额的客户，按合计从大到小排序。再告诉我怎么和总账 1122 应收账款核对。”',
            ],
          },
          {
            heading: '让 AI 解释每一步',
            body: [
              '拿到 SQL 后别急着用。让 AI 用中文逐段解释：每个 JOIN 为什么这样连、会不会一对多、WHERE 条件包不包括边界那一天、NULL 怎么处理。解释不通的地方，就是要追问的地方。',
              '还可以要求它改写成 WITH 分步的写法，你一步一步运行，看每一步的行数和金额是不是符合预期。',
            ],
          },
          {
            heading: '先小后大，先验算再相信',
            body: [
              '先让 AI 写只查一个客户或一个月的版本，你手工算一下能不能对上，再放开到全部数据。比如南山设计（C003）的账很简单，开票合计减收款合计就是它还欠的钱：',
              { code: `SELECT (SELECT SUM(total_amount) FROM ar_invoices WHERE customer_id = 'C003') AS 开票合计,
       (SELECT SUM(amount) FROM ar_receipts WHERE customer_id = 'C003') AS 收款合计;`,
                result: '开票合计\t收款合计\n95598.00\t58534.00' },
              '两者相减是 37,064.00。如果 AI 的账龄表里 C003 的合计也是这个数，再去看其他客户；对不上，就先弄清楚是谁错了。',
            ],
          },
        ],
        askQuestions: [
          '我该怎样把公司财务软件的表结构整理给 AI，又不泄露真实数据？',
          '请帮我检查这段需求描述，口径上还有哪些没说清楚的地方？',
          '请把你写的 SQL 改写成 WITH 分步的形式，并说明每一步预计返回多少行。',
        ],
        task: {
          prompt: '练习向 AI 提一个完整的需求。参考答案和预期结果在 answers.sql 第 13 课。',
          criteria: [
            '用 information_schema 导出 ap_invoices、ap_payments、ap_payment_applications 三张表的列说明',
            '按本节的五项口径，写一段请 AI 计算“截至 2026-03-31 按供应商的应付账款账龄”的需求',
            '把 AI 返回的 SQL 在练习库运行，并让它逐段解释',
            '挑一个供应商手工验算，确认和 AI 的结果对得上',
          ],
        },
        reflection: {
          question: '为什么说“口径”是会计在和 AI 协作时最大的价值？举一个口径不清导致数字不同的例子。',
          answer: 'SQL 怎么写 AI 很在行，但数应该怎么算，取决于业务和会计规则，AI 只能猜。比如“3 月的收入”：按开票日期还是凭证日期？含不含税？要不要扣除退货、折让？期初余额凭证算不算？每个选择都会让数字不同，而 AI 会挑一个看起来合理的默认值，不一定告诉你。会计把口径说清楚，AI 写出来的才是你要的数。',
        },
        quiz: [
          {
            id: 'prompt-ai-q1',
            prompt: '让 AI 算“3 月的费用合计”时，下面哪一项最需要补充说明？',
            options: ['你希望结果用什么字体、字号和颜色显示，怎么排版', '“3 月”按哪个日期、含哪些科目、利息冲不冲减', '你用的是哪款电脑、哪个版本的操作系统'],
            answer: 1,
            explanation: '期间、范围、冲减规则都是口径。不说清楚，AI 写出的 SQL 可能能运行，但数字和你理解的不一样。',
          },
          {
            id: 'prompt-ai-q2',
            prompt: '把表结构告诉 AI 时，哪种做法更合适？',
            options: ['什么都不给，让 AI 按常见财务软件自己猜表名和列名', '把整张客户表的数据全部复制给 AI，让它看得更清楚', '只给结构和表间关系，不给真实数据'],
            answer: 2,
            explanation: 'AI 写 SQL 只需要结构和口径。真实数据可能涉及客户隐私和公司机密，没有必要给。',
          },
          {
            id: 'prompt-ai-q3',
            prompt: 'AI 写的账龄查询里，截止日用的是 CURDATE()（今天的日期）。主要问题是？',
            options: ['结果每天都会变，对不上期末账面', 'MySQL 不支持 CURDATE()', '查询会变慢，因为每一行都要重新取一次今天的日期'],
            answer: 0,
            explanation: '账龄要和某个结账日的总账核对，截止日必须是固定日期。用 CURDATE()，今天跑和明天跑的结果都不同，也没法复核。',
          },
        ],
      },
    },
    {
      id: 'check-ai',
      stage: 'ai',
      title: '检查 AI 的结果：勾稽、抽查和常见错误',
      summary: '用总额勾稽找出未核销收款，识别连表后金额翻倍、空值和期间边界的错误。',
      level: 3,
      dimensions: ['ai', 'apply'],
      prereqs: ['ar-ap', 'prompt-ai'],
      lesson: {
        sections: [
          {
            heading: '第一招：总额勾稽',
            body: [
              '不管 SQL 多复杂，结果的总数都要能和一个你信得过的数对上：明细合计对总账，本月对上月加变动，报表对科目余额表。第 9 课发现：未收发票合计 685,686.00，总账应收 663,086.00，差 22,600.00。现在来找原因。',
              '总账里减少应收的是收款凭证，明细里减少应收的是核销记录。差额最可能是“钱收了、记了账，但没核销到发票上”。用 LEFT JOIN 找没有任何核销记录的收款：',
              { code: `SELECT r.receipt_no, r.customer_id, r.receipt_date, r.amount
FROM ar_receipts r
LEFT JOIN ar_receipt_applications a ON a.receipt_id = r.receipt_id
WHERE a.receipt_id IS NULL;`,
                result: 'receipt_no\tcustomer_id\treceipt_date\tamount\nSK-2603-008\tC005\t2026-03-27\t22600.00' },
              '找到了：青松物业（C005）3 月 27 日付来 22,600.00，记了账，但没有核销。青松物业正好有两张 22,600.00 的未收发票（2 月、3 月各一张），财务不确定它付的是哪一张，就先挂着。处理办法是联系客户确认，再做核销。',
              '所以正确的勾稽关系是：未收发票合计 − 未核销收款 = 总账应收账款余额，即 685,686.00 − 22,600.00 = 663,086.00。',
            ],
          },
          {
            heading: '第二招：警惕连表后金额翻倍',
            body: [
              'AI 最常犯、也最难一眼看出的错：一对多连接后，对“一”那边的金额求和。比如算每个客户的收款合计，它可能这样写：',
              { code: `SELECT r.customer_id, SUM(r.amount) AS 收款合计
FROM ar_receipts r
JOIN ar_receipt_applications a ON a.receipt_id = r.receipt_id
GROUP BY r.customer_id
ORDER BY r.customer_id;`,
                result: 'customer_id\t收款合计\nC001\t410868.00\nC002\t161250.00\nC003\t58534.00\nC004\t40000.00\nC005\t59890.00\nC006\t86672.00' },
              '正确的写法是直接在收款表上求和：',
              { code: `SELECT customer_id, SUM(amount) AS 收款合计
FROM ar_receipts
GROUP BY customer_id
ORDER BY customer_id;`,
                result: 'customer_id\t收款合计\nC001\t289958.00\nC002\t161250.00\nC003\t58534.00\nC004\t40000.00\nC005\t82490.00\nC006\t86672.00' },
              '对比：北辰科技（C001）多了 120,910.00，因为 3 月 10 日那笔收款同时核销了两张发票，在核销表里有两行，连接后收款金额出现了两次；青松物业（C005）少了 22,600.00，因为那笔没核销的收款在核销表里没有记录，JOIN 把它丢掉了。一条查询里两种错，方向还相反，合计数反而不容易看出问题。',
              '检查办法：连接前后数一数行数；对一张表的金额求和时，先在这张表上单独求和，再和连接后的结果比一比。',
            ],
          },
          {
            heading: '第三招：空值和期间边界',
            body: [
              "空值：WHERE dept_id <> 'D02' 不会选出 dept_id 是 NULL 的行。下面一次数出四个数。SUM(条件) 在 MySQL 里等于“满足条件的行数”：",
              { code: `SELECT COUNT(*) AS 全部分录,
       SUM(dept_id = 'D02') AS 销售部,
       SUM(dept_id <> 'D02') AS 只写不等于,
       SUM(dept_id <> 'D02' OR dept_id IS NULL) AS 加上空值
FROM voucher_lines;`,
                result: '全部分录\t销售部\t只写不等于\t加上空值\n325\t17\t43\t308' },
              '“只写不等于”加“销售部”远远小于全部分录，因为没有部门的分录行都被漏掉了。想要“不是销售部的所有分录”，要把 OR dept_id IS NULL 加上。',
              "期间边界：AI 常写 BETWEEN '2026-03-01' AND '2026-03-31' 来筛选带时间的列，会漏掉月末那天零点以后的记录（第 6 课）。看到日期条件，就检查最后一天有没有被完整包括进来。截止日写成 CURDATE() 的、按录入时间而不是凭证日期取期间的、忘了排除期初余额凭证的，都要追问。",
            ],
          },
          {
            heading: '第四招：抽查明细',
            body: [
              '从结果里挑两三行，到明细里手工核对：挑金额最大的、挑你最熟悉的客户、挑看起来奇怪的（负数、特别大、NULL）。',
              '检查清单：1）总数和总账或上一期对得上吗？2）行数合理吗？3）有没有一对多连接？4）NULL 怎么处理？5）期间边界包括最后一天吗？6）截止日是固定日期吗？7）抽查的明细对得上吗？',
            ],
          },
        ],
        askQuestions: [
          '请检查这条 SQL 有没有一对多连接导致的重复计算，并说明你是怎么判断的。',
          '应收明细和总账对不上时，除了未核销收款，还有哪些常见原因？',
          '给我一份检查 SQL 结果的清单，适合会计在交给领导之前使用。',
        ],
        task: {
          prompt: '亲手做一次“检查 AI”。参考答案在 answers.sql 第 14 课。',
          criteria: [
            '找出未核销的收款，写出应收勾稽公式和三个数字',
            '运行“收款合计”的错误写法和正确写法，逐个客户说明差多少、为什么',
            '写一条“不属于销售部的分录行数”的查询，把没有部门（NULL）的行也算进去，确认结果是 308 而不是 43',
            '用本节的检查清单，逐项检查你在第 13 课让 AI 写的应付账龄查询',
          ],
        },
        reflection: {
          question: '为什么“连表后金额翻倍”这种错特别危险？结合本节的例子说一说。',
          answer: '因为它不报错，结果看起来也像模像样：数字是对的格式、对的列名，只是偏大或偏小。在本节的例子里，一个客户多算了，一个客户少算了，如果只看合计，两个错误还会部分抵消，更难发现。只有把结果和一个独立来源的数（单表求和、总账余额）对一对，或者数一数连接前后的行数，才能发现。',
        },
        quiz: [
          {
            id: 'check-ai-q1',
            prompt: 'C001 在收款表上单独求和是 289,958.00，下面这条查询的结果却是 410,868.00。原因是？',
            code: `SELECT SUM(r.amount) AS 收款合计
FROM ar_receipts r
JOIN ar_receipt_applications a ON a.receipt_id = r.receipt_id
WHERE r.customer_id = 'C001';`,
            options: ['一笔收款核销了两张发票，连接后被算了两次', '有一笔收款没有核销，被 JOIN 漏掉了，所以合计变大', '收款表里有一笔收款重复录入了两次，需要删掉一笔', '查询没有按日期筛选，把 2025 年的收款也算进来了'],
            answer: 0,
            explanation: '3 月 10 日那笔 120,910.00 的收款核销了两张发票，连接后出现两次，多算了 120,910.00。要对收款金额求和，就不要连接核销表，或者先把核销表汇总成每笔收款一行。',
          },
          {
            id: 'check-ai-q2',
            prompt: 'AI 给出的应收账龄合计是 685,686.00，总账应收余额是 663,086.00。你应该先做什么？',
            options: ['直接用账龄合计，因为明细比总账更可靠', '把总账调成和账龄合计一致，差额做一张调整凭证', '把差额记到其他应收款，等月底再处理', '先找差额原因，比如有没有未核销的收款'],
            answer: 3,
            explanation: '明细和总账不一致，说明某个环节有问题，要先查明原因。练习库里的原因是一笔 22,600.00 的收款没有核销，两边的数其实都“对”，只是口径差了这一笔。',
          },
          {
            id: 'check-ai-q3',
            prompt: '同事想数“不属于销售部的分录行”，写了下面这条。它漏掉了什么？',
            code: `SELECT COUNT(*) AS 行数
FROM voucher_lines
WHERE dept_id <> 'D02';`,
            options: ['漏掉了编号排在 D02 后面的部门，因为不等于只比较一个方向', '漏掉了 dept_id 为 NULL（没有部门）的行', '什么都没漏，不等于会把 NULL 也当成不是 D02'],
            answer: 1,
            explanation: 'NULL 和 D02 比较的结果是“不知道”，WHERE 不保留这些行。练习库里大部分分录（收入、往来、银行）都没有部门，全被漏掉了。',
          },
        ],
      },
    },
    {
      id: 'safety',
      stage: 'ai',
      title: '安全习惯：只读账号、不改正式数据、保护敏感信息',
      summary: '用只读账号查询，修改前先开事务，不把敏感数据贴给 AI。',
      level: 2,
      dimensions: ['ai', 'concept'],
      prereqs: ['setup'],
      lesson: {
        sections: [
          {
            heading: '查询用只读账号',
            body: [
              '本课程练习时用 root（管理员账号），因为数据库就在你自己电脑上，练坏了可以重新导入。工作中连接公司的数据库，应该请 IT 开一个只读账号：只能查（SELECT），不能改，也不能删。',
              '下面是在练习服务器上建一个只读账号的写法，密码请换成你自己的。IF NOT EXISTS 表示“已经有这个账号就不再建”，重复运行也不会报错：',
              { code: `CREATE USER IF NOT EXISTS 'acct_reader'@'localhost' IDENTIFIED BY 'Change-Me-2026';
GRANT SELECT ON acct_practice.* TO 'acct_reader'@'localhost';` },
              '查看这个账号有什么权限：',
              { code: `SHOW GRANTS FOR 'acct_reader'@'localhost';`,
                result: 'Grants for acct_reader@localhost\nGRANT USAGE ON *.* TO `acct_reader`@`localhost`\nGRANT SELECT ON `acct_practice`.* TO `acct_reader`@`localhost`' },
              "USAGE 的意思是“能登录，但没有任何权限”；第二行给了它 acct_practice 库的 SELECT 权限。@'localhost' 表示只能从这台电脑登录。用这个账号连接后，任何修改语句都会被拒绝，手滑也不怕。",
            ],
          },
          {
            heading: '不在正式数据上直接改',
            body: [
              'UPDATE（修改）、DELETE（删除）、INSERT（插入）会真的改变数据，而且没有 Excel 那样的“撤销”。会计数据的更正，应该在财务软件里做冲销或更正凭证，留下记录，而不是直接改数据库。',
              '如果要在练习库里试一试修改，先开一个事务（transaction：一组操作，要么全部生效，要么全部取消），看清结果再决定，不想要就回滚（ROLLBACK）：',
              { code: `START TRANSACTION;
UPDATE voucher_lines SET credit = 1350.00
WHERE voucher_id = (SELECT voucher_id FROM vouchers WHERE voucher_no = '2026-03-016')
  AND account_code = '1002';
SELECT SUM(debit) - SUM(credit) AS 试算差额 FROM voucher_lines;
ROLLBACK;`,
                result: '试算差额\n0.00' },
              '中间的 SELECT 显示差额变成 0，说明这样改能让账平；最后的 ROLLBACK 把修改撤销，数据回到原样。注意：DROP、CREATE 这类改表结构的语句不能回滚；而且在事务里运行它们，MySQL 会先悄悄提交（COMMIT）前面还没回滚的修改，之后再 ROLLBACK 也撤销不了。所以事务里只放 UPDATE、DELETE、INSERT 和 SELECT。',
              'UPDATE 和 DELETE 一定要带 WHERE。动手之前，先用同样的 WHERE 写一条 SELECT，确认选中的正好是你想改的那几行。',
            ],
          },
          {
            heading: '敏感数据不贴给 AI',
            body: [
              '给 AI 的应该是表结构和口径，不是真实数据。客户名称、身份证号、银行账号、工资明细、还没公开的财务数字，都不要贴进对话框。需要举例时，用虚构数据，或者把名称换成“客户A”。',
              '公司如果规定了可以用哪些 AI 工具（比如内部部署的版本），以公司规定为准。导出的查询结果（Excel、CSV）也是敏感文件，用完删除，不要放在公共网盘。',
            ],
          },
          {
            heading: '一份照着做的习惯清单',
            body: [
              '1）连接正式数据库只用只读账号；2）新查询先在练习库或测试库里试；3）改数据前先 SELECT、再开事务；4）给 AI 只给结构和口径；5）重要的结果保留 SQL 和截止日，方便别人复核。',
            ],
          },
        ],
        askQuestions: [
          '向 IT 申请数据库只读账号时，应该怎么写申请，说明哪些内容？',
          '数据库事务是什么？哪些操作不能用 ROLLBACK 撤销？',
          '把查询结果交给 AI 分析之前，怎么做脱敏？',
        ],
        task: {
          prompt: '在练习服务器上把安全习惯走一遍。参考答案在 answers.sql 第 15 课。',
          criteria: [
            '创建只读账号 acct_reader，并用 SHOW GRANTS 确认它只有 SELECT 权限',
            '用 acct_reader 连接（终端里用 -u acct_reader -p），运行一条 UPDATE，确认被拒绝',
            '用 root 开事务试一次修改并回滚，确认试算差额又回到 -180.00',
            '写下你所在公司对 AI 工具和数据外发的规定（不清楚就去问）',
          ],
        },
        reflection: {
          question: '为什么会计更正错账要做更正凭证，而不是直接在数据库里改数？',
          answer: '会计记录要能追溯：谁、在什么时候、因为什么改了什么。更正凭证会留下原错误和更正过程，审计和复核都能看到；直接在数据库里改数，原来的数字就没了，财务软件里的报表、核销、余额也可能和底层数据对不上，还可能违反公司的内控规定。数据库层面的修改只应该由 IT 在审批后做，并留下记录。',
        },
        quiz: [
          {
            id: 'safety-q1',
            prompt: '下面这段运行完以后，练习库里 2026-03-016 号凭证银行存款那行的贷方是多少？',
            code: `START TRANSACTION;
UPDATE voucher_lines SET credit = 1350.00
WHERE voucher_id = (SELECT voucher_id FROM vouchers WHERE voucher_no = '2026-03-016')
  AND account_code = '1002';
SELECT SUM(debit) - SUM(credit) AS 试算差额 FROM voucher_lines;
ROLLBACK;`,
            options: ['1,350.00', '0.00，因为中间的 SELECT 显示差额是 0', '1,530.00，修改已被撤销'],
            answer: 2,
            explanation: '事务里的修改在 ROLLBACK 之后全部取消。中间的 SELECT 能看到修改后的效果（差额 0），但最终数据没有变。',
          },
          {
            id: 'safety-q2',
            prompt: '想把一批作废凭证从正式数据库里删掉，最合适的做法是？',
            options: ['按规定作废或冲销，必要时请 IT 审批处理并留痕', '用 root 账号直接 DELETE，删之前先备份一下整张表', '让 AI 写 DELETE 语句，检查一遍语法没错就直接运行'],
            answer: 0,
            explanation: '正式账务数据的修改要走财务软件的流程或经过审批，并留下记录。直接删除没有痕迹，也可能破坏和其他数据的对应关系。',
          },
          {
            id: 'safety-q3',
            prompt: '请 AI 帮忙写工资分析的 SQL 时，可以给它什么？',
            options: ['全体员工的工资明细，这样 AI 能看到真实的数据分布', '员工的身份证号和银行账号，方便 AI 核对是谁', '工资表的列名、类型和口径说明'],
            answer: 2,
            explanation: '写 SQL 只需要结构和口径。工资明细、身份证号、银行账号都是敏感个人信息，不应该贴给 AI。',
          },
        ],
      },
    },
  ],

  assessment: {
    questions: [
      {
        id: 'mya-q1', node: 'db-basics', dimension: 'concept',
        prompt: '在数据库里，一张表的“主键”是什么？',
        options: ['金额最大、最重要的那一列，比如价税合计', '表的名字，同一个库里每张表各不相同', '不重复、能唯一确定一行的列，如凭证号', '表的第一行，相当于 Excel 的标题行'],
        answer: 2,
        explanation: '主键保证每一行都能被准确地找到，值不能重复，就像同一账套里的凭证号。',
      },
      {
        id: 'mya-q2', node: 'acct-tables', dimension: 'concept',
        prompt: '练习库把凭证拆成 vouchers（凭证头）和 voucher_lines（分录行）两张表。它们是什么关系？',
        options: ['一对多：一张凭证对应多行分录，靠 voucher_id 连接', '多对一：一行分录可以同时属于好几张凭证，靠摘要连接', '两张表没有关系，只是名字都和凭证有关', '一对一：两张表内容一样，一张是另一张的备份'],
        answer: 0,
        explanation: '凭证头每张凭证一行，分录每条一行，分录行上的 voucher_id 指回它所属的凭证。',
      },
      {
        id: 'mya-q3', node: 'select-basics', dimension: 'read',
        prompt: '下面这条查询返回什么？',
        code: `SELECT invoice_no, total_amount
FROM ar_invoices
WHERE customer_id = 'C003'
ORDER BY total_amount DESC
LIMIT 1;`,
        options: ['C003 金额最小的一张发票', 'C003 的所有发票', '所有客户里金额最大的发票', 'C003 金额最大的一张发票'],
        answer: 3,
        explanation: '先筛选出 C003 的发票，按金额从大到小排序，只取第一行，就是 C003 金额最大的一张。',
      },
      {
        id: 'mya-q4', node: 'aggregate', dimension: 'read',
        prompt: '下面这条查询的结果里有一行 dept_id 是 NULL。它代表什么？',
        code: `SELECT dept_id, COUNT(*) AS 行数
FROM voucher_lines
GROUP BY dept_id
ORDER BY dept_id;`,
        options: ['查询出错了', '没有部门的分录行归成的一组', '部门表里有一个没有名字、编号为空的部门', '销售部的分录，因为它的编号排在最前面'],
        answer: 1,
        explanation: 'GROUP BY 会把 NULL 当成一组。收入、往来、银行这些分录没有部门，都落在这一组。',
      },
      {
        id: 'mya-q5', node: 'dates', dimension: 'apply',
        prompt: '要筛选 created_at（带时分秒的录入时间）在 2026 年 1 月的记录，哪种写法最稳妥？',
        options: ['created_at 在 1 月 1 日和 1 月 31 日之间（BETWEEN）', 'created_at 的月份等于 1', 'created_at 大于等于 1 月 1 日，并且小于 2 月 1 日'],
        answer: 2,
        explanation: 'BETWEEN 会把 1 月 31 日当成零点，漏掉当天的记录；只看月份会把别的年份的 1 月也算进来。“>= 月初 且 < 下月初”最稳妥。',
      },
      {
        id: 'mya-q6', node: 'joins', dimension: 'read',
        prompt: '1221 其他应收款没有任何分录。下面这条查询的结果是？',
        code: `SELECT a.account_name, SUM(l.debit) AS 借方合计
FROM accounts a
LEFT JOIN voucher_lines l ON l.account_code = a.account_code
WHERE a.account_code = '1221'
GROUP BY a.account_name;`,
        options: ['没有任何行', '一行：其他应收款，借方合计是 NULL', '一行：其他应收款，借方合计是 0.00', '报错'],
        answer: 1,
        explanation: 'LEFT JOIN 保留了科目表这一行，右边对不上，l.debit 是 NULL；SUM 一组里全是 NULL，结果就是 NULL。要显示 0，可以写 COALESCE(SUM(l.debit), 0)。',
      },
      {
        id: 'mya-q7', node: 'vouchers-gl', dimension: 'apply',
        prompt: '科目余额表里，应付账款（负债，余额方向在贷方）的期末余额怎么算？',
        options: ['借方合计 − 贷方合计', '借方合计 + 贷方合计', '贷方合计 − 借方合计', '只看最后一笔分录的金额'],
        answer: 2,
        explanation: '贷方科目的余额 = 贷 − 借，正数表示贷方余额。资产、成本费用类科目则是借 − 贷。',
      },
      {
        id: 'mya-q8', node: 'ar-ap', dimension: 'apply',
        prompt: '账龄截至 2026-03-31，按开票日计算。一张 2026-01-30 开出、还没收的发票落在哪一段？',
        code: `SELECT DATEDIFF('2026-03-31', '2026-01-30') AS 天数;`,
        options: ['0–30 天', '31–60 天', '61–90 天', '90 天以上'],
        answer: 1,
        explanation: '3 月 31 日减 1 月 30 日是 60 天，正好落在 31–60 天这一段的上边界。边界那天算哪一段，要在口径里写清楚。',
      },
      {
        id: 'mya-q9', node: 'read-complex', dimension: 'ai',
        prompt: 'SUM(金额) OVER (ORDER BY 月份) 算出来的是什么？',
        options: ['从第一个月累计到当前月的金额', '每个月自己的金额，和不写 OVER 时一样', '所有月份的总额，每一行显示的都是同一个数', '每个月的金额从大到小的排名'],
        answer: 0,
        explanation: '带 ORDER BY 的 SUM() OVER 是累计求和：每一行都是从第一行加到当前行。',
      },
      {
        id: 'mya-q10', node: 'check-ai', dimension: 'ai',
        prompt: 'AI 写的查询先把收款表和核销表 JOIN 起来，再对收款金额求和。最可能出什么问题？',
        options: ['查询会更快，因为核销表先把收款筛选了一遍', '核销多张发票的收款被重复计算，未核销的被漏掉', '没有问题，JOIN 只是把核销信息附加到每笔收款上', '只会报错，MySQL 不允许对连接后的金额求和'],
        answer: 1,
        explanation: '收款和核销是一对多：核销多张发票的收款会出现多次，没核销的收款在 JOIN 中被丢掉。要在收款表上单独求和。',
      },
    ],
  },
};
