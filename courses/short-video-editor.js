// Demo role pack: 短视频剪辑师 (zh-Hans). Schema: see README.md in this folder.
// A general picture of the job, not any specific employer's requirements.
// Most lessons are shared from the 视频剪辑基础 pack ({ ref }); progress is separate.

const VE = 'video-editing-basics';

export default {
  schema: 1,
  id: 'short-video-editor',
  type: 'role',
  lang: 'zh-Hans',
  title: '短视频剪辑师',
  summary: '先看这个岗位每天实际要做哪些工作、交出什么，再反推需要哪些能力，按你和岗位要求的差距排出学习路径。',
  demoNotice: '这是示范内容：岗位要求来自对“短视频剪辑师”工作的一般了解，不代表某家公司的具体要求。想规划真实岗位，请把岗位名称和招聘要求发给 Claude，生成你专属的岗位课程。',

  levels: [
    { id: 1, label: '入门了解', desc: '知道这个岗位做什么，看得懂常用术语。' },
    { id: 2, label: '能独立完成', desc: '能独立接一条短视频，从需求到交付。' },
    { id: 3, label: '熟练', desc: '能稳定、高效地交付有质感的作品。' },
  ],

  dimensions: [
    { id: 'concept', label: '概念理解' },
    { id: 'operate', label: '操作熟练' },
    { id: 'story', label: '叙事节奏' },
    { id: 'polish', label: '声画打磨' },
    { id: 'collab', label: '沟通交付' },
  ],

  stages: [
    { id: 'prep', title: '接单与准备', summary: '问清需求，整理素材。' },
    { id: 'cut', title: '剪辑', summary: '操作、镜头、剪辑点和节奏。' },
    { id: 'deliver', title: '打磨与交付', summary: '声音、字幕、颜色、包装和交付。' },
  ],

  nodes: [
    {
      id: 'brief',
      stage: 'prep',
      title: '理解需求与沟通',
      summary: '把模糊的要求变成可以执行的清单，减少返工。',
      level: 1,
      dimensions: ['collab'],
      prereqs: [],
      lesson: {
        sections: [
          { heading: '先问清楚再动手', body: [
            '剪辑返工最常见的原因，是一开始没对齐需求。',
            '接单时至少确认：用途（宣传、记录还是投放广告）、发布平台、时长、画幅、风格参考、交付时间，以及可以修改几次。',
          ] },
          { heading: '用参考视频对齐“感觉”', body: [
            '“高级一点”“有活力”这类词，每个人的理解都不一样。请对方给一两个参考视频，并说清楚喜欢它的哪一点：节奏、颜色、字幕样式，还是音乐。',
          ] },
          { heading: '把需求写下来', body: [
            '把聊到的内容整理成一份简短的需求确认单，发给对方确认。以后有分歧时，以这份清单为准。',
          ] },
          { heading: '处理反馈', body: [
            '请对方按时间点给意见，例如“0:12 这里的音乐太吵”；意见收集齐了再一次修改。',
            '超出约定范围的大改（比如换掉整个结构），先沟通时间和费用，再动手。',
          ] },
        ],
        askQuestions: [
          '做短视频剪辑接单时，需求确认单通常包括哪些项目？',
          '客户的修改意见前后矛盾时，怎么沟通比较好？',
          '怎么礼貌地说明“这个修改超出了约定范围”？',
        ],
        task: {
          prompt: '找一位朋友或同学，请他假装要你剪一条视频。用 10 分钟问清需求，写成一份确认单。',
          criteria: [
            '确认单写明了用途、发布平台、时长和画幅',
            '拿到了至少 1 个参考视频，并写下对方喜欢它的哪一点',
            '写明了交付时间和可以修改几次',
            '对方看过确认单并表示同意',
          ],
        },
        reflection: {
          question: '为什么说“先剪一版给客户看看”，往往比先问清需求更费时间？',
          answer: '没对齐需求就动手，等于在猜对方要什么。猜错了，前面的整理、粗剪和精剪可能都要推倒重来，而且每一轮都要等对方反馈。先花十几分钟问清用途、平台、时长和风格参考，第一版就更接近目标，后面只需要小改。',
        },
        quiz: [
          {
            id: 'brief-q1',
            prompt: '客户只说了一句“要有活力一点”。下一步最好怎么做？',
            options: ['把所有镜头都加速一倍', '请对方给参考视频，问清是节奏、音乐还是颜色上的“活力”', '加很多闪白转场', '不理会这句话'],
            answer: 1,
            explanation: '“有活力”可能指节奏快、音乐欢快或颜色明亮。用参考视频把抽象的词变成具体的样子，才能剪到点上；凭感觉加速或加特效很可能剪偏。',
          },
          {
            id: 'brief-q2',
            prompt: '客户陆续发来很多零散的修改意见。最高效的处理方式是？',
            options: ['请对方按时间点集中整理意见，一次改完再交付', '收到一条改一条，每次都导出给对方看', '只改自己认为对的意见'],
            answer: 0,
            explanation: '集中收集、一次修改，能避免反复导出和来回确认，也能发现前后矛盾的意见并先沟通清楚。',
          },
        ],
      },
    },
    { ref: `${VE}:workflow`, stage: 'prep' },
    { ref: `${VE}:timeline`, stage: 'cut' },
    { ref: `${VE}:shots`, stage: 'cut' },
    { ref: `${VE}:cut-points`, stage: 'cut' },
    { ref: `${VE}:pacing`, stage: 'cut' },
    { ref: `${VE}:audio`, stage: 'deliver' },
    { ref: `${VE}:subtitles`, stage: 'deliver' },
    { ref: `${VE}:color`, stage: 'deliver' },
    {
      id: 'packaging',
      stage: 'deliver',
      title: '封面与标题包装',
      summary: '让人在一排视频里一眼看懂、愿意点开，同时不夸大。',
      level: 2,
      dimensions: ['polish', 'collab'],
      prereqs: [],
      lesson: {
        sections: [
          { heading: '封面的任务', body: [
            '在视频列表里，观众先看到封面和标题，再决定点不点。封面要让人一眼看懂：这条视频讲什么，有什么看点。',
          ] },
          { heading: '选画面', body: [
            '选主体清楚、表情或动作有张力的一帧，也可以单独拍一张。避开模糊、主体太小或背景杂乱的画面。',
          ] },
          { heading: '封面上的文字', body: [
            '字少而大，通常一句话就够；和背景颜色反差要大；放在平台不会遮挡的位置。',
            '同一系列用统一的版式和颜色，观众更容易认出你的内容。',
          ] },
          { heading: '标题', body: [
            '标题要说清内容和看点，可以用数字、结果或问题，但不要夸大或与内容不符。观众看完觉得被骗，会很快划走，也会降低对账号的信任。',
          ] },
        ],
        askQuestions: [
          '不同平台的封面尺寸和显示区域有什么不同？',
          '系列视频的封面模板怎么设计？',
          '怎么写一个具体又不夸张的标题？',
        ],
        task: {
          prompt: '为你剪过的一条视频做一个封面、写一个标题，再做一个对比版本。',
          criteria: [
            '封面主体清楚，缩小到手机列表里的大小时仍然看得清',
            '封面文字不超过 15 个字，和背景反差明显',
            '标题说清了内容和看点，没有夸大',
            '做了两个版本，请 2 个人选更想点开的一个，并记下原因',
          ],
        },
        reflection: {
          question: '为什么说“标题党”短期可能带来更多点击，长期却会伤害账号？',
          answer: '夸大的标题能骗来点击，但观众看完发现内容不符，会很快划走、不点赞，甚至反感。完播和互动下降，平台的推荐会减少；观众也会记住“这个账号的标题不可信”，以后不再点开。长期稳定的增长，来自标题和内容一致、让人看完觉得值。',
        },
        quiz: [
          {
            id: 'pack-q1',
            prompt: '下面哪个封面在手机列表里最容易被看清？',
            options: ['画面里放一大段说明文字', '用远景，人物很小', '主体占画面的大部分，配一句大字标题', '颜色和文字都很淡'],
            answer: 2,
            explanation: '手机列表里的封面很小，只有主体大、文字少而大、反差明显的封面才能一眼看清。',
          },
          {
            id: 'pack-q2',
            prompt: '关于短视频标题，哪种做法最合适？',
            options: ['只写拍摄日期', '越夸张越好，先把人吸引进来', '和视频内容无关也可以', '写清内容和看点，可以用数字或结果，但不夸大'],
            answer: 3,
            explanation: '具体、真实的标题能吸引真正感兴趣的观众，看完也不会失望；夸大或无关的标题会损害信任和推荐。',
          },
        ],
      },
    },
    { ref: `${VE}:export`, stage: 'deliver' },
    {
      id: 'delivery',
      stage: 'deliver',
      title: '版本管理与交付',
      summary: '版本命名、按平台出片、素材授权和交付清单。',
      level: 2,
      dimensions: ['collab', 'operate'],
      prereqs: ['export'],
      lesson: {
        sections: [
          { heading: '命名和版本', body: [
            '每次发给客户看的版本都单独导出并编号，例如“咖啡店宣传_v2_精剪_0315”。',
            '不要用“最终版”“最最终版”：几轮修改之后，谁也分不清哪个才是最新的。',
          ] },
          { heading: '按平台交付', body: [
            '同一条内容发多个平台时，按各平台的画幅（竖屏 9:16、横屏 16:9、方形 1:1）分别出版本。每个版本都要检查字幕和主体在画面内、没有被平台按钮挡住。',
          ] },
          { heading: '版权和素材来源', body: [
            '商用视频里的音乐、字体、图片和视频素材，都需要有使用授权。把每样素材的来源和授权情况记在清单里，交付时一并说明。',
          ] },
          { heading: '交付清单和备份', body: [
            '交付前对照清单检查：成片文件（格式、分辨率、帧率）、封面、需要时的字幕文件、素材授权说明。',
            '工程和素材留一份备份，方便以后修改。',
          ] },
        ],
        askQuestions: [
          '可以商用的音乐和字体一般从哪里获取？要注意哪些授权条件？',
          '给客户交付时，工程文件要不要一起给？',
          '怎么设计一套自己的文件命名规则？',
        ],
        task: {
          prompt: '把你的一条视频当成要交给客户的作品，整理一套交付包。',
          criteria: [
            '导出至少两个不同画幅的版本，每个版本里字幕和主体都没有被裁掉',
            '文件名包含项目名、版本号和日期',
            '列出视频里用到的音乐、字体和素材，以及它们的来源',
            '工程和素材有一份备份',
          ],
        },
        reflection: {
          question: '为什么不建议把文件命名为“最终版”？',
          answer: '剪辑几乎总会再改。第一次叫了“最终版”，之后就只能叫“最终版2”“真的最终版”，自己和客户都分不清哪个最新、哪个是对方确认过的。用版本号加日期，顺序一目了然，沟通时说“v3”，双方指的就是同一个文件。',
        },
        quiz: [
          {
            id: 'deliv-q1',
            prompt: '同一条视频要发竖屏平台和横屏平台，最稳妥的交付方式是？',
            options: ['只交横屏版，竖屏平台会自动适配', '按 9:16 和 16:9 分别做版本，检查字幕和主体没有被裁掉', '交一个方形版本，两边通用'],
            answer: 1,
            explanation: '平台自动适配往往会加大片空白或裁掉画面。分别按画幅出版本并逐个检查，才能保证每个平台上都看得完整。',
          },
          {
            id: 'deliv-q2',
            prompt: '下面哪个文件名最适合交付给客户？',
            options: ['最终版.mp4', '新建视频(3).mp4', '咖啡店宣传_v3_精剪_0315.mp4', 'aaa.mp4'],
            answer: 2,
            explanation: '包含项目名、版本号、阶段和日期的文件名，双方都能立刻知道这是哪个项目的第几版。',
          },
          {
            id: 'deliv-q3',
            prompt: '商用视频里用了一首网上下载的流行歌曲做背景音乐，需要注意什么？',
            options: ['需要取得相应的使用授权，否则可能侵权', '只要在视频里标注歌名就可以', '只用 15 秒以内就一定没问题', '平台会自动处理，不用管'],
            answer: 0,
            explanation: '标注歌名或只用很短的片段，并不能代替授权。商用前要确认音乐有可用的授权，例如购买授权或使用平台提供的可商用曲库。',
          },
        ],
      },
    },
  ],

  assessment: {
    questions: [
      { id: 'r-brief', ability: 'ab-brief', node: 'brief', dimension: 'collab', prompt: '客户说“剪得高级一点”。动手之前，最应该做什么？', options: ['按自己的理解先剪一版', '请对方给一两个参考视频，并确认用途、平台、时长和交付时间', '直接加很多特效和转场', '把素材全部用上'], answer: 1, explanation: '“高级”是抽象的说法，用参考视频和基本规格把它变具体，能避免剪完被推翻。' },
      { id: 'r-material', ability: 'ab-material', node: 'workflow', dimension: 'operate', prompt: '一个项目有 200 段素材。开始剪之前，先做哪件事最省时间？', options: ['先按场景或内容把素材分类，标出可用的片段', '从第一段开始逐个剪', '先挑背景音乐', '先做封面'], answer: 0, explanation: '先整理、标记可用素材，剪的时候才能快速找到需要的镜头；直接从头剪会在大量废片上浪费时间。' },
      { id: 'r-edit1', ability: 'ab-edit', node: 'timeline', dimension: 'operate', prompt: '剪口播时，想删掉中间一段口误并让后面的片段自动补上，用的是？', options: ['倒放', '定格', '波纹删除', '分离音频'], answer: 2, explanation: '波纹删除会在删除的同时把后面的内容前移，不留空隙。' },
      { id: 'r-edit2', ability: 'ab-edit', node: 'cut-points', dimension: 'story', prompt: '从全景切到特写拍“人拿起手机”，剪辑点放在哪里最顺？', options: ['动作开始之前', '拿起手机的动作过程中', '动作结束好几秒后'], answer: 1, explanation: '在动作进行中切换，连续的动作会带着视线越过剪辑点，衔接最自然。' },
      { id: 'r-story', ability: 'ab-story', node: 'pacing', dimension: 'story', prompt: '一条 15 秒的产品短视频，开头最好放什么？', options: ['5 秒的品牌 logo 动画', '创作者的自我介绍', '一段空镜', '产品最吸引人的效果或使用结果'], answer: 3, explanation: '短视频的观众在前几秒就决定是否继续看，开头直接给出看点最能留住人。' },
      { id: 'r-audio', ability: 'ab-audio', node: 'audio', dimension: 'polish', prompt: '客户反馈“手机外放听不清人声”。最可能的原因和处理是？', options: ['人声太小或被音乐盖住：有人声的地方压低音乐', '画面太暗：把画面调亮', '帧率太低：改成 60fps', '字幕太小：把字幕放大'], answer: 0, explanation: '手机扬声器小，音乐稍大就会盖住人声。说话的段落压低音乐（闪避），再用外放检查一遍。' },
      { id: 'r-visual', ability: 'ab-visual', node: 'packaging', dimension: 'polish', prompt: '短视频封面最重要的作用是？', options: ['只放 logo，显得专业', '放下尽量多的文字信息', '在一排视频里让人一眼看懂内容并想点开', '和内容无关也没关系'], answer: 2, explanation: '封面是观众决定点不点的第一印象，要让人一眼看懂内容和看点。' },
      { id: 'r-delivery', ability: 'ab-delivery', node: 'export', dimension: 'operate', prompt: '客户要同一条视频发抖音和 B 站横版。交付时最合理的做法是？', options: ['只交一个竖屏版本，让客户自己裁', '导出一个最高分辨率的版本', '只交工程文件', '分别按 9:16 和 16:9 做版本，按平台导出并清楚命名'], answer: 3, explanation: '不同平台画幅不同，分别出版本、检查字幕和主体、清楚命名，客户拿到就能直接用。' },
    ],
  },

  role: {
    abilities: [
      { id: 'ab-brief', title: '需求沟通', requiredLevel: 2, nodes: ['brief'],
        what: '把客户或团队模糊的想法，变成清楚的需求和交付标准；在修改过程中保持高效沟通。',
        practice: ['每接一条视频，都写一份需求确认单并请对方确认', '收集 3 个你喜欢的参考视频，用一句话说清各自的风格'] },
      { id: 'ab-material', title: '素材与工程管理', requiredLevel: 2, nodes: ['workflow'],
        what: '把大量素材整理得井井有条，工程设置正确，素材不丢失、找得快。',
        practice: ['给下一个项目先建好文件夹或专用相册，再开始剪', '剪完后检查：工程能否在另一台设备上打开、素材是否齐全'] },
      { id: 'ab-edit', title: '剪辑操作', requiredLevel: 3, nodes: ['timeline', 'cut-points'],
        what: '熟练使用剪辑软件完成分割、修剪、删除等操作，剪辑点干净自然。',
        practice: ['给自己计时：把 1 分钟口播的停顿和口误全部剪掉', '找一段动作素材，练习在动作中切换并逐帧检查'] },
      { id: 'ab-story', title: '镜头与节奏', requiredLevel: 3, nodes: ['shots', 'pacing'],
        what: '会用不同景别讲清一件事，能控制节奏，让开头抓人、全片不拖。',
        practice: ['拆解一条你喜欢的短视频：数一数每个镜头多长、开头 3 秒放了什么', '同一组素材剪一个快节奏版和一个慢节奏版，对比感受'] },
      { id: 'ab-audio', title: '声音处理', requiredLevel: 2, nodes: ['audio'],
        what: '人声清楚、音乐不抢、全程不爆音，在耳机和手机外放上都听得舒服。',
        practice: ['每条成片都用耳机和手机外放各听一遍', '练习在有人声的段落压低音乐，人声停下时再提起'] },
      { id: 'ab-visual', title: '字幕、调色与包装', requiredLevel: 2, nodes: ['subtitles', 'color', 'packaging'],
        what: '字幕准确好读，画面颜色自然统一，封面和标题让人想点开。',
        practice: ['每条视频的字幕都逐条校对', '为同一条视频做两个封面，请别人选更想点开的一个'] },
      { id: 'ab-delivery', title: '规格与交付', requiredLevel: 2, nodes: ['export', 'delivery'],
        what: '按平台要求导出正确的规格，版本清楚、素材授权清楚，交付一次到位。',
        practice: ['整理一份你自己的交付检查清单，每次交付前对照', '给文件定一套命名规则：项目名_版本号_日期'] },
    ],
    tasks: [
      { id: 't-brief', title: '接需求、定方向', desc: '和客户或团队确认这条视频要做成什么样，什么时候交。', outputs: ['需求确认单：用途、平台、时长、画幅、风格参考、交付时间', '约定好的修改次数和反馈方式'], abilities: ['ab-brief'] },
      { id: 't-ingest', title: '整理素材、搭工程', desc: '收齐拍摄素材，分类整理，建好剪辑工程。', outputs: ['按项目整理好的素材（专用文件夹或相册）', '画幅、帧率设置正确的剪辑工程'], abilities: ['ab-material', 'ab-edit'] },
      { id: 't-rough', title: '粗剪出结构', desc: '挑出要用的段落，按顺序排好，先得到一个能从头看到尾的版本。', outputs: ['粗剪版：结构完整、时长接近要求'], abilities: ['ab-edit', 'ab-story'] },
      { id: 't-fine', title: '精剪与节奏打磨', desc: '调整每个剪辑点和镜头时长，打磨开头和节奏。', outputs: ['精剪版：剪辑点顺、节奏合适、开头抓人'], abilities: ['ab-story', 'ab-edit'] },
      { id: 't-polish', title: '声音、字幕和画面', desc: '处理人声和音乐，加字幕并校对，统一画面颜色。', outputs: ['人声清楚、音乐不抢的声音', '校对过的字幕', '颜色统一的画面'], abilities: ['ab-audio', 'ab-visual'] },
      { id: 't-deliver', title: '包装与交付', desc: '做封面和标题，按平台导出各个版本，整理交付包。', outputs: ['封面和标题', '按各平台规格导出的成片', '命名清楚的最终文件、授权说明和工程备份'], abilities: ['ab-visual', 'ab-delivery', 'ab-brief'] },
    ],
  },
};
