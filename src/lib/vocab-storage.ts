import { getUserLevel, learningLevels, normalizeLearningLevel, type LearningLevel } from './level-config';
import { validateTopicWord, wordKey, type GeneratedTopicWord } from './topic-generation';
import { topicDefinitions } from './topic-vocab';

export interface VocabItem {
  id: string; word: string; phonetic: string; translation: string;
  collocations: string[]; exampleEn: string; exampleZh: string; level: LearningLevel;
  status: 'in_bank' | 'mastered'; addedAt: number;
  source: 'daily_recommend' | 'chat_pick' | 'manual'; reviewCount?: number; createdAt?: number;
}
export type VocabInput = Omit<VocabItem, 'id' | 'addedAt'> & Partial<Pick<VocabItem, 'id' | 'addedAt'>>;
export interface DailyProgress { date: string; level: LearningLevel; passed: string[]; added: string[]; }
export interface DailyRecommendState { date: string; level: LearningLevel; wordIds: string[]; currentIndex: number; handled: Record<string, 'passed' | 'added'>; }
export interface TopicPack { id: string; title: string; subtitle: string; category: 'travel' | 'work' | 'exam' | 'daily'; words: VocabItem[]; }
const STORAGE_KEY = 'english-coach.vocab.v1';
const DAILY_KEY = 'english-coach.vocab.daily.v1';
const DAILY_RECOMMEND_KEY = 'english-coach.vocab.daily-recommend.v1';
const TOPIC_EXTRA_KEY = 'english-coach.vocab.topic-extra.v1';
const TOPIC_PROGRESS_KEY = 'english-coach.vocab.topic-progress.v1';
export const VOCAB_UPDATED_EVENT = 'english-coach:vocab-updated';
const isBrowser = () => typeof window !== 'undefined';
const levels = learningLevels.map(item => item.id);
const normalizeLevel = normalizeLearningLevel;
type WordData = [string, string, string, string[], string, string];
const data: Record<LearningLevel, WordData[]> = {
  L1: [
    ['order', '/ˈɔːrdər/', '点餐；点单', ['order a coffee', 'place an order'], "I would like to order a coffee, please.", '我想点一杯咖啡。'],
    ['menu', '/ˈmenjuː/', '菜单', ['a lunch menu', 'look at the menu'], 'Can I see the menu, please?', '可以给我看看菜单吗？'],
    ['milk', '/mɪlk/', '牛奶', ['oat milk', 'a glass of milk'], 'Can I have oat milk?', '可以换成燕麦奶吗？'],
    ['check', '/tʃek/', '账单', ['get the check', 'split the check'], 'Can we get the check, please?', '请给我们账单好吗？'],
    ['gate', '/ɡeɪt/', '登机口', ['boarding gate', 'at gate twelve'], 'Where is gate twelve?', '十二号登机口在哪里？'],
    ['ticket', '/ˈtɪkɪt/', '车票；机票', ['bus ticket', 'one-way ticket'], 'One ticket, please.', '请给我一张票。'],
    ['bus', '/bʌs/', '公交车', ['take a bus', 'bus stop'], 'Where is the bus stop?', '公交车站在哪里？'],
    ['arrive', '/əˈraɪv/', '到达', ['arrive early', 'arrive at the station'], 'We arrive at six.', '我们六点到。'],
    ['delicious', '/dɪˈlɪʃəs/', '美味的', ['delicious food', 'look delicious'], 'This soup is delicious.', '这汤真好喝。'],
    ['water', '/ˈwɔːtər/', '水', ['a glass of water', 'drink water'], 'Some water, please.', '请给我一些水。'],
  ],
  L2: [
    ['lease', '/liːs/', '租约', ['sign a lease', 'a one-year lease'], 'Can I read the lease first?', '我能先看一下租约吗？'],
    ['deposit', '/dɪˈpɑːzɪt/', '押金', ['security deposit', 'get a deposit back'], 'When can I get my deposit back?', '我什么时候能拿回押金？'],
    ['leak', '/liːk/', '漏水', ['a water leak', 'fix a leak'], 'There is a leak under the sink.', '水槽下面漏水了。'],
    ['landlord', '/ˈlændlɔːrd/', '房东', ['call the landlord', 'ask the landlord'], 'I will call the landlord today.', '我今天会给房东打电话。'],
    ['available', '/əˈveɪləbəl/', '有空的；可用的', ['available today', 'be available for a call'], 'Are you available for a quick call?', '你有空快速通个电话吗？'],
    ['handover', '/ˈhændoʊvər/', '工作交接', ['handover notes', 'project handover'], 'I left handover notes for you.', '我给你留了交接说明。'],
    ['follow up', '/ˈfɑːloʊ ʌp/', '跟进', ['follow up on an email', 'follow up with a client'], "I will follow up with you tomorrow.", '我明天再联系你跟进。'],
    ['take a day off', '/teɪk ə deɪ ɔːf/', '请一天假', ['take Friday off', 'request a day off'], 'Can I take Friday off?', '我可以周五请假吗？'],
    ['prefer', '/prɪˈfɜːr/', '更喜欢', ['prefer tea', 'prefer to walk'], 'I prefer tea to coffee.', '比起咖啡我更喜欢茶。'],
    ['comfortable', '/ˈkʌmftərbəl/', '舒服的；自在的', ['feel comfortable', 'comfortable shoes'], 'These shoes are comfortable.', '这双鞋很舒服。'],
  ],
  L3: [
    ['point out', '/pɔɪnt aʊt/', '指出', ['point out a problem', 'point out a detail'], 'She pointed out a useful detail in the report.', '她指出了报告中一个有用的细节。'],
    ['depend on', '/dɪˈpend ɑːn/', '取决于；依靠', ['depend on the situation', 'depend on your goal'], 'The best choice depends on your goal.', '最佳选择取决于你的目标。'],
    ['carry out', '/ˈkæri aʊt/', '开展；执行', ['carry out research', 'carry out a plan'], 'Our team carried out a short survey.', '我们团队做了一次简短调查。'],
    ['suggest', '/səˈdʒest/', '建议', ['suggest an idea', 'suggest a change'], 'I would suggest starting with the main issue.', '我建议先从主要问题开始。'],
    ['figure out', '/ˈfɪɡjər aʊt/', '弄清楚；想办法解决', ['figure out a way', 'figure it out'], 'We can figure it out together.', '我们可以一起想办法解决。'],
    ['catch up', '/kætʃ ʌp/', '叙旧；赶上', ['catch up with friends', 'catch up on work'], 'We should grab coffee and catch up.', '我们应该喝杯咖啡叙叙旧。'],
    ['schedule', '/ˈskedʒuːl/', '日程；安排', ['busy schedule', 'schedule a meeting'], 'My schedule is pretty flexible this week.', '我这周的日程挺灵活。'],
    ['convenient', '/kənˈviːniənt/', '方便的', ['a convenient time', 'convenient location'], 'Would tomorrow be more convenient?', '明天会更方便吗？'],
    ['probably', '/ˈprɑːbəbli/', '大概；很可能', ['probably will', 'most probably'], 'I will probably take the earlier train.', '我大概会坐早一点的火车。'],
    ['worthwhile', '/ˌwɜːrθˈwaɪl/', '值得的', ['worthwhile experience', 'worthwhile effort'], 'The extra effort was worthwhile.', '额外的努力很值得。'],
  ],
  L4: [
    ['proposal', '/prəˈpoʊzəl/', '提案；方案', ['put forward a proposal', 'review a proposal'], 'I would like to put forward a proposal for next quarter.', '我想提出一个下季度的方案。'],
    ['trade-off', '/ˈtreɪd ɔːf/', '权衡；取舍', ['make a trade-off', 'a reasonable trade-off'], 'There is a trade-off between speed and cost.', '速度和成本之间需要权衡。'],
    ['align on', '/əˈlaɪn ɑːn/', '就……达成一致', ['align on priorities', 'align on a timeline'], 'Can we align on the key priorities first?', '我们能先就关键优先事项达成一致吗？'],
    ['push back', '/pʊʃ bæk/', '提出异议；延期', ['push back on an idea', 'push back the deadline'], 'I see the benefit, though I would push back on the timeline.', '我理解好处，不过对时间安排有不同看法。'],
    ['perspective', '/pərˈspektɪv/', '观点；角度', ['from my perspective', 'broader perspective'], 'Travel gave me a different perspective.', '旅行让我有了不同的看法。'],
    ['assumption', '/əˈsʌmpʃən/', '假设', ['make an assumption', 'underlying assumption'], 'We should challenge that underlying assumption.', '我们应该质疑那个潜在假设。'],
    ['approach', '/əˈproʊtʃ/', '方法', ['a practical approach', 'a different approach'], 'We need a more practical approach.', '我们需要更实际的方法。'],
    ['outcome', '/ˈaʊtkʌm/', '结果；成果', ['positive outcome', 'desired outcome'], 'The outcome was better than expected.', '结果比预想更好。'],
    ['persuasive', '/pərˈsweɪsɪv/', '有说服力的', ['persuasive argument', 'persuasive evidence'], 'She made a persuasive case for the change.', '她为这项改变提出了有说服力的理由。'],
    ['collaborate', '/kəˈlæbəreɪt/', '合作', ['collaborate closely', 'collaborate on a project'], 'We collaborated closely on the project.', '我们在这个项目上密切合作。'],
  ],
  L5: [
    ['nuance', '/ˈnuːɑːns/', '细微差别', ['capture the nuance', 'cultural nuance'], 'The translation misses a subtle cultural nuance.', '这个翻译遗漏了微妙的文化含义。'],
    ['compelling', '/kəmˈpelɪŋ/', '有力的；引人入胜的', ['compelling reason', 'compelling story'], 'She offered a compelling reason to reconsider our stance.', '她给出了重新考虑立场的有力理由。'],
    ['articulate', '/ɑːrˈtɪkjəleɪt/', '清晰表达', ['articulate a concern', 'articulate an idea'], 'He articulated the concerns we had struggled to put into words.', '他清晰表达了我们一直难以说清的担忧。'],
    ['pragmatic', '/præɡˈmætɪk/', '务实的', ['pragmatic approach', 'pragmatic solution'], 'A pragmatic compromise might serve everyone better.', '务实的折中方案可能对所有人更好。'],
    ['coherent', '/koʊˈhɪrənt/', '连贯的；有条理的', ['coherent argument', 'coherent strategy'], 'The proposal needs a more coherent long-term strategy.', '提案需要更连贯的长期策略。'],
    ['subtle', '/ˈsʌtəl/', '微妙的', ['subtle difference', 'subtle hint'], 'There was a subtle shift in how she framed the issue.', '她阐述问题的方式有微妙变化。'],
    ['inevitable', '/ɪnˈevɪtəbəl/', '不可避免的', ['inevitable change', 'seem inevitable'], 'Some disruption is inevitable when we challenge the status quo.', '挑战现状时，一些动荡不可避免。'],
    ['contradictory', '/ˌkɑːntrəˈdɪktəri/', '矛盾的', ['contradictory evidence', 'contradictory claims'], 'The seemingly contradictory findings deserve a closer look.', '看似矛盾的发现值得仔细研究。'],
    ['read between the lines', '/riːd bɪˈtwiːn ðə laɪnz/', '领会言外之意', ['read between the lines carefully', 'learn to read between the lines'], 'Reading between the lines, I sensed that she had reservations.', '从言外之意我感觉到她有所保留。'],
    ['go the extra mile', '/ɡoʊ ði ˈekstrə maɪl/', '多做一步；加倍努力', ['go the extra mile for clients', 'willing to go the extra mile'], 'She consistently goes the extra mile without seeking recognition.', '她总是多做一步，也不求认可。'],
  ],
};
function makeWord(row: WordData, level: LearningLevel, id: string): VocabItem {
  const [word, phonetic, translation, collocations, exampleEn, exampleZh] = row;
  return { id, word, phonetic, translation, collocations, exampleEn, exampleZh, level, status: 'in_bank', addedAt: 0, source: 'daily_recommend' };
}
const topicPacks: TopicPack[] = topicDefinitions.map(({ byLevel, ...topic }) => ({
  ...topic, words: levels.flatMap(level => byLevel[level].map((row, index) => makeWord(row, level, topic.id + '-' + level + '-' + index))),
}));
// Preserve the existing daily batch order: saved daily IDs are positional.
const dailyExtras: Record<string, WordData> = {
  journey: ['journey', '/ˈdʒɜːrni/', '旅程', ['a long journey', 'safe journey'], 'Have a safe journey home.', '回家一路平安。'],
  relaxed: ['relaxed', '/rɪˈlækst/', '放松的', ['feel relaxed', 'stay relaxed'], 'I feel relaxed after a walk.', '散步后我感觉很放松。'],
  decide: ['decide', '/dɪˈsaɪd/', '决定', ['decide to go', 'make a decision'], 'We need to decide before noon.', '我们需要在中午前做决定。'],
  usually: ['usually', '/ˈjuːʒuəli/', '通常', ['usually do', 'as usual'], 'I usually walk to work.', '我通常走路上班。'],
  enough: ['enough', '/ɪˈnʌf/', '足够的', ['good enough', 'enough time'], 'Do we have enough time?', '我们时间够吗？'],
  borrow: ['borrow', '/ˈbɑːroʊ/', '借用', ['borrow a book', 'borrow from'], 'Can I borrow your pen?', '我可以借你的笔吗？'],
  choose: ['choose', '/tʃuːz/', '选择', ['choose between', 'choose wisely'], 'You can choose any seat.', '你可以选择任何座位。'],
  nearby: ['nearby', '/ˌnɪrˈbaɪ/', '附近的', ['nearby cafe', 'live nearby'], 'There is a nearby cafe.', '附近有一家咖啡馆。'],
  recommend: ['recommend', '/ˌrekəˈmend/', '推荐', ['highly recommend', 'recommend a place'], 'Would you recommend this restaurant?', '你推荐这家餐厅吗？'],
  conversation: ['conversation', '/ˌkɑːnvərˈseɪʃən/', '谈话', ['have a conversation', 'start a conversation'], 'We had a great conversation.', '我们聊得很愉快。'],
  exactly: ['exactly', '/ɪɡˈzæktli/', '确切地；正是', ['exactly right', 'that is exactly why'], 'That is exactly what I mean.', '这正是我的意思。'],
  actually: ['actually', '/ˈæktʃuəli/', '实际上；其实', ['actually think', 'actually quite'], 'I actually enjoy cooking.', '其实我很喜欢做饭。'],
  notice: ['notice', '/ˈnoʊtɪs/', '注意到', ['notice a change', 'notice that'], 'Did you notice the sign?', '你注意到那个标志了吗？'],
  'make sense': ['make sense', '/meɪk sens/', '讲得通；有道理', ['make perfect sense', 'does that make sense?'], 'That makes a lot of sense.', '那很有道理。'],
  'hang out': ['hang out', '/hæŋ aʊt/', '闲逛；一起消磨时间', ['hang out with friends', 'hang out together'], 'Do you want to hang out this weekend?', '这周末你想一起出去玩吗？'],
  'work out': ['work out', '/wɜːrk aʊt/', '解决；进展顺利', ['work out a solution', 'things work out'], 'Everything worked out in the end.', '最后一切都顺利解决了。'],
  'pick up': ['pick up', '/pɪk ʌp/', '学会；接人；取物', ['pick up a skill', 'pick someone up'], 'I picked up a few useful phrases on my trip.', '我旅行时学会了几个实用短语。'],
  'on the same page': ['on the same page', '/ɑːn ðə seɪm peɪdʒ/', '想法一致；达成共识', ['get on the same page', 'make sure we are on the same page'], 'I just want to make sure we are on the same page.', '我只是想确认我们想法一致。'],
  'come up with': ['come up with', '/kʌm ʌp wɪð/', '想出；提出', ['come up with an idea', 'come up with a plan'], 'Can you come up with a better idea?', '你能想出更好的主意吗？'],
  'break the ice': ['break the ice', '/breɪk ði aɪs/', '打破僵局；活跃气氛', ['break the ice with a joke', 'an icebreaker'], 'A simple question can break the ice.', '一个简单的问题就能打破僵局。'],
  reliable: ['reliable', '/rɪˈlaɪəbəl/', '可靠的', ['reliable source', 'highly reliable'], 'We need a reliable source of information.', '我们需要可靠的信息来源。'],
  nuanced: ['nuanced', '/ˈnuːɑːnst/', '细致的；有细微差别的', ['nuanced view', 'more nuanced'], 'It is a more nuanced view of the issue.', '这是对该问题更细致的看法。'],
};
const dailyOrder: Record<LearningLevel, string[]> = {
  L1: ['arrive', 'delicious', 'journey', 'relaxed', 'decide', 'usually', 'enough', 'borrow', 'choose', 'nearby'],
  L2: ['available', 'prefer', 'recommend', 'conversation', 'comfortable', 'exactly', 'actually', 'notice', 'make sense', 'hang out'],
  L3: ['figure out', 'catch up', 'work out', 'pick up', 'schedule', 'suggest', 'available', 'convenient', 'probably', 'worthwhile'],
  L4: ['on the same page', 'come up with', 'break the ice', 'perspective', 'assumption', 'approach', 'outcome', 'persuasive', 'collaborate', 'reliable'],
  L5: ['go the extra mile', 'read between the lines', 'subtle', 'nuance', 'compelling', 'inevitable', 'articulate', 'nuanced', 'contradictory', 'pragmatic'],
};
const allRows = [...Object.values(data).flat(), ...Object.values(dailyExtras)];
const dailyData = Object.fromEntries(levels.map(level => [level, dailyOrder[level].map(word => allRows.find(row => row[0] === word)!)])) as Record<LearningLevel, WordData[]>;
function normalize(raw: Partial<VocabItem>, index: number): VocabItem {
  return { id: raw.id || `seed-${index + 1}`, word: raw.word || '', phonetic: raw.phonetic || '', translation: raw.translation || '', collocations: Array.isArray(raw.collocations) ? raw.collocations : [], exampleEn: raw.exampleEn || raw.word || '', exampleZh: raw.exampleZh || '', level: normalizeLevel(raw.level), status: raw.status === 'mastered' ? 'mastered' : 'in_bank', addedAt: raw.addedAt || raw.createdAt || Date.now(), source: raw.source === 'chat_pick' || raw.source === 'manual' ? raw.source : 'daily_recommend', reviewCount: raw.reviewCount || 0 };
}
function read(): VocabItem[] {
  if (!isBrowser()) return [];
  try { const raw: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(raw) ? raw.filter(item => item && typeof item === 'object' && !String(item.id || '').startsWith('seed-')).map(normalize) : []; } catch { return []; }
}
function write(items: VocabItem[]) { if (isBrowser()) { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); window.dispatchEvent(new Event(VOCAB_UPDATED_EVENT)); } }
const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
export function getVocabList() { return read(); }
export function getBankList() { return read().filter(item => item.status === 'in_bank'); }
// Extra words live separately from the curated pool so existing positional IDs remain stable.
function getExpandedPacks(): TopicPack[] {
  let saved: Record<string, unknown> = {};
  if (isBrowser()) {
    try {
      const value: unknown = JSON.parse(window.localStorage.getItem(TOPIC_EXTRA_KEY) || '{}');
      if (value && typeof value === 'object' && !Array.isArray(value)) saved = value as Record<string, unknown>;
    } catch { /* Keep curated vocabulary available even if local storage is damaged. */ }
  }
  return topicPacks.map(pack => {
    const extras = Array.isArray(saved[pack.id]) ? saved[pack.id] as unknown[] : [];
    const seen = new Set(pack.words.map(word => word.level + ':' + wordKey(word.word)));
    const ids = new Set(pack.words.map(word => word.id));
    const words = [...pack.words];
    for (const value of extras) {
      if (!value || typeof value !== 'object') continue;
      const item = value as VocabItem;
      if (!levels.includes(item.level)) continue;
      const valid = validateTopicWord(item, item.level);
      if (!valid || typeof item.id !== 'string' || !item.id.startsWith('topic-extra-') || ids.has(item.id)) continue;
      const key = item.level + ':' + wordKey(valid.word);
      if (seen.has(key)) continue;
      seen.add(key); ids.add(item.id);
      words.push({ ...valid, id: item.id, status: 'in_bank', source: 'daily_recommend', addedAt: Number(item.addedAt) || 0 });
    }
    return { ...pack, words };
  });
}
export function getTopicPacks(level: LearningLevel = getUserLevel()): TopicPack[] {
  return getExpandedPacks().map(pack => ({ ...pack, words: pack.words.filter(word => word.level === level) }));
}
export function appendTopicWords(packId: string, level: LearningLevel, input: GeneratedTopicWord[]): number {
  if (!isBrowser()) throw new Error('请在浏览器中保存场景词汇。');
  const packs = getExpandedPacks();
  const pack = packs.find(item => item.id === packId);
  if (!pack || !levels.includes(level)) throw new Error('场景或等级无效。');
  const seen = new Set(pack.words.filter(word => word.level === level).map(word => wordKey(word.word)));
  const additions: VocabItem[] = [];
  for (const row of input) {
    const item = validateTopicWord(row, level);
    if (!item) throw new Error('新词数据不完整，未保存。');
    if (seen.has(wordKey(item.word))) continue;
    seen.add(wordKey(item.word));
    additions.push({ ...item, id: 'topic-extra-' + (globalThis.crypto?.randomUUID?.() || Date.now() + '-' + Math.random().toString(36).slice(2)), status: 'in_bank', source: 'daily_recommend', addedAt: Date.now() });
  }
  if (!additions.length) return 0;
  const next = Object.fromEntries(packs.map(item => [item.id,
    [...item.words.filter(word => word.id.startsWith('topic-extra-')), ...(item.id === packId ? additions : [])]]));
  try { window.localStorage.setItem(TOPIC_EXTRA_KEY, JSON.stringify(next)); }
  catch { throw new Error('本地存储空间不足或不可用，新词未保存，请检查浏览器存储设置。'); }
  window.dispatchEvent(new Event(VOCAB_UPDATED_EVENT));
  return additions.length;
}
export function getTopicPackProgress(): Record<string, string[]> {
  if (!isBrowser()) return {};
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(TOPIC_PROGRESS_KEY) || '{}');
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
    return Object.fromEntries(getExpandedPacks().map(pack => { const ids = (saved as Record<string, unknown>)[pack.id]; return [pack.id, Array.isArray(ids) ? [...new Set(ids.filter((id): id is string => typeof id === 'string' && pack.words.some(word => word.id === id)))] : []]; }));
  } catch { return {}; }
}
export function markTopicWordMastered(packId: string, wordId: string) {
  const progress = getTopicPackProgress();
  if (!getExpandedPacks().some(pack => pack.id === packId && pack.words.some(word => word.id === wordId))) return progress;
  progress[packId] = [...new Set([...(progress[packId] || []), wordId])];
  if (isBrowser()) window.localStorage.setItem(TOPIC_PROGRESS_KEY, JSON.stringify(progress));
  if (isBrowser()) window.dispatchEvent(new Event(VOCAB_UPDATED_EVENT));
  return progress;
}
export function addToBank(input: VocabInput): VocabItem[] {
  const items = read(); const duplicate = items.find(item => item.level === input.level && item.word.trim().toLowerCase() === input.word.trim().toLowerCase());
  const next = duplicate ? items.map(item => item.id === duplicate.id ? { ...item, ...input, id: item.id, addedAt: item.addedAt, status: 'in_bank' as const } : item) : [normalize({ ...input, id: `vocab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, addedAt: Date.now() }, items.length), ...items];
  write(next); return next;
}
export function addVocab(input: { word: string; phonetic?: string; translation?: string; collocations?: string[]; exampleEn?: string; exampleZh?: string; level?: LearningLevel; source?: VocabItem['source'] }) {
  return addToBank({ word: input.word, phonetic: input.phonetic || '', translation: input.translation || '待补充中文释义', collocations: input.collocations || [], exampleEn: input.exampleEn || input.word, exampleZh: input.exampleZh || '待补充例句翻译', level: input.level || getUserLevel(), status: 'in_bank', source: input.source || 'manual' });
}
export function removeFromBank(id: string) { const next = read().map(item => item.id === id ? { ...item, status: 'mastered' as const } : item); write(next); return next; }
export function toggleMastered(id: string) { const next = read().map(item => item.id === id ? { ...item, status: item.status === 'mastered' ? 'in_bank' as const : 'mastered' as const, reviewCount: (item.reviewCount || 0) + 1 } : item); write(next); return next; }
export function deleteVocab(id: string) { const next = read().filter(item => item.id !== id); write(next); return next; }
function buildDailyRecommendations(level: LearningLevel, date: string) { return dailyData[level].map((row, index) => makeWord(row, level, `daily-${date}-${level}-${index}`)); }
export function getDailyRecommendState(level: LearningLevel = getUserLevel()): DailyRecommendState {
  const date = today();
  if (isBrowser()) { try { const saved = JSON.parse(window.localStorage.getItem(DAILY_RECOMMEND_KEY + '.' + level) || window.localStorage.getItem(DAILY_RECOMMEND_KEY) || 'null') as Partial<DailyRecommendState> | null; if (saved?.date === date && saved.level === level && Array.isArray(saved.wordIds) && saved.wordIds.length === 10) return { date, level, wordIds: saved.wordIds, currentIndex: Math.min(Math.max(Number(saved.currentIndex) || 0, 0), 10), handled: saved.handled && typeof saved.handled === 'object' ? saved.handled : {} }; } catch { /* Restore with a fresh daily batch. */ } }
  const fresh: DailyRecommendState = { date, level, wordIds: buildDailyRecommendations(level, date).map(item => item.id), currentIndex: 0, handled: {} };
  if (isBrowser()) window.localStorage.setItem(DAILY_RECOMMEND_KEY + '.' + level, JSON.stringify(fresh)); return fresh;
}
export function getDailyRecommendations(level: LearningLevel = getUserLevel()) { const state = getDailyRecommendState(level); const byId = new Map(buildDailyRecommendations(level, state.date).map(item => [item.id, item])); return state.wordIds.map(id => byId.get(id)).filter((item): item is VocabItem => Boolean(item)); }
export function markDailyHandled(id: string, status: 'passed' | 'added', level: LearningLevel) {
  const state = getDailyRecommendState(level); const handled = { ...state.handled, [id]: status }; const index = state.wordIds.findIndex(wordId => !handled[wordId]); const next = { ...state, handled, currentIndex: index < 0 ? 10 : index };
  if (isBrowser()) window.localStorage.setItem(DAILY_RECOMMEND_KEY + '.' + level, JSON.stringify(next)); return next;
}
export function getWordReference(word: string, level: LearningLevel = getUserLevel()) {
  const key = word.trim().toLowerCase();
  const topicWord = getTopicPacks(level).flatMap(pack => pack.words).find(item => item.word.toLowerCase() === key);
  if (topicWord) return { phonetic: topicWord.phonetic, translation: topicWord.translation, collocations: topicWord.collocations, exampleEn: topicWord.exampleEn, exampleZh: topicWord.exampleZh };
  const row = [...dailyData[level], ...data[level]].find(item => item[0].toLowerCase() === key);
  return row ? { phonetic: row[1], translation: row[2], collocations: row[3], exampleEn: row[4], exampleZh: row[5] } : { phonetic: '', translation: '结合原对话语境理解', collocations: [], exampleEn: '', exampleZh: '' };
}

export function getDailyProgress(level: LearningLevel): DailyProgress { if (isBrowser()) { try { const state = JSON.parse(window.localStorage.getItem(DAILY_KEY) || 'null') as DailyProgress | null; if (state?.date === today() && state.level === level) return state; } catch { /* Use empty progress. */ } } return { date: today(), level, passed: [], added: [] }; }
function markDaily(word: string, level: LearningLevel, kind: 'passed' | 'added') { const state = getDailyProgress(level); if (!state[kind].includes(word)) state[kind].push(word); if (isBrowser()) window.localStorage.setItem(DAILY_KEY, JSON.stringify(state)); return state; }
export function markDailyPassed(word: string, level: LearningLevel) { return markDaily(word, level, 'passed'); }
export function markDailyAdded(word: string, level: LearningLevel) { return markDaily(word, level, 'added'); }
