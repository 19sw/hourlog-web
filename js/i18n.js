// Localization: zh-Hans + en. Strings mirror HourLog/Resources/Localizable.xcstrings.

export const STRINGS = {
  en: {
    appName: 'HourLog',
    tabLog: 'Log', tabTimeline: 'Timeline',
    prompt: 'What are you doing?',
    placeholder: 'Write what you just did…',
    save: 'Save', cancel: 'Cancel', delete: 'Delete',
    savedAt: 'Saved at {time}',
    saveFailed: "Couldn't save. Please try again.",
    micStart: 'Tap to talk', micStop: 'Tap to finish', listening: 'Listening…',
    micDenied: 'Microphone or speech recognition access is off. Allow it in your browser or phone settings to use voice input, or use the microphone on your keyboard to dictate. Typing still works.',
    micUnsupported: "This browser doesn't support voice input on the page. Tap the microphone on your phone keyboard to dictate instead. Typing still works.",
    micFailed: 'Speech recognition failed. Please try again or type your entry.',
    prevDay: 'Previous day', nextDay: 'Next day', date: 'Date',
    nothing: 'Nothing logged', addEntry: 'Add entry',
    newEntry: 'New Entry', editEntry: 'Edit Entry', entry: 'Entry', time: 'Time',
    deleteTitle: 'Delete this entry?', deleteBody: "This can't be undone.",
    today: 'Today',
    mascotAsk: 'What have you been up to?', mascotSaved: 'Saved!',
    dayEmptyToday: 'Nothing logged yet', dayEmptyOther: 'Nothing logged this day',
    storageWarn: "Your browser can't save data (private mode?). Entries will be lost when you close this page.",
    tipTitle: 'Add to Home Screen',
    tipBody: 'In Safari tap Share, then "Add to Home Screen" to open this like an app. Entries are stored only in this browser on this phone: clearing website data deletes them, and iOS may clear data if you do not open the site for about 7 days (adding it to the Home Screen avoids this). There are no hourly reminders in the web version; use your Reminders app or an alarm.',
    tipPrivacy: 'Voice input may send audio to Apple/Google speech servers.',
    gotIt: 'Got it',
    help: 'Help',
    errEmpty: 'Please enter some text.',
    errTime: 'Please enter a valid date and time.',
  },
  'zh-Hans': {
    appName: '时刻日志',
    tabLog: '记录', tabTimeline: '时间线',
    prompt: '你刚才在干什么？',
    placeholder: '写下你刚才在做什么…',
    save: '保存', cancel: '取消', delete: '删除',
    savedAt: '已保存于 {time}',
    saveFailed: '保存失败，请重试。',
    micStart: '点按说话', micStop: '点按结束', listening: '正在聆听…',
    micDenied: '麦克风或语音识别权限未开启。请在浏览器或手机设置中允许后使用语音输入，也可以用手机键盘上的麦克风听写；打字记录不受影响。',
    micUnsupported: '此浏览器不支持网页内语音输入。请点按手机键盘上的麦克风进行听写，效果一样；打字记录不受影响。',
    micFailed: '语音识别失败，请重试或直接打字。',
    prevDay: '前一天', nextDay: '后一天', date: '日期',
    nothing: '暂无记录', addEntry: '补记',
    newEntry: '新记录', editEntry: '编辑记录', entry: '内容', time: '时间',
    deleteTitle: '删除这条记录？', deleteBody: '此操作无法撤销。',
    today: '今天',
    mascotAsk: '刚才在做什么呀？', mascotSaved: '记好啦！',
    dayEmptyToday: '今天还没有记录哦', dayEmptyOther: '这天还没有记录哦',
    storageWarn: '浏览器无法保存数据（可能是无痕模式）。关闭此页面后记录会丢失。',
    tipTitle: '添加到主屏幕',
    tipBody: '在 Safari 中点“分享”，再点“添加到主屏幕”，即可像 App 一样全屏打开。记录只保存在这部手机的这个浏览器里：清除网站数据会丢失记录；如果约 7 天不打开且未添加到主屏幕，iOS 可能自动清除数据。网页版没有每小时提醒，可用“提醒事项”或闹钟代替。',
    tipPrivacy: '语音输入可能会把声音发送到 Apple/Google 的语音服务器。',
    gotIt: '知道了',
    help: '帮助',
    errEmpty: '请输入内容。',
    errTime: '请输入有效的日期和时间。',
  },
};

/** 'zh-CN', 'zh-Hans-CN', 'zh-TW', ... -> 'zh-Hans' for any zh*, else 'en'. */
export function pickLocale(languages) {
  const list = Array.isArray(languages) ? languages : [languages];
  for (const l of list) {
    if (typeof l !== 'string') continue;
    const low = l.toLowerCase();
    if (low.startsWith('zh')) return 'zh-Hans';
    if (low.startsWith('en')) return 'en';
  }
  return 'en';
}

export function speechLang(locale) {
  return locale === 'zh-Hans' ? 'zh-CN' : 'en-US';
}

export function t(locale, key, vars) {
  const s = (STRINGS[locale] && STRINGS[locale][key]) ?? STRINGS.en[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : '')) : s;
}
