type TitleMessage = { role: string; content: string };

/** Only user messages establish the topic; the coach's greeting must not bias it. */
export function generateSessionTitle(messages: TitleMessage[]): string {
 const turns = messages.filter(message => message.role === 'user' && message.content.trim());
 if (!turns.length) return '新对话';
 const text = turns.map(message => message.content).join('\n').toLowerCase();
 const park = /\bparks?\b|公园/.test(text);
 const barbecue = /\b(?:bbq|barbecues?|barbecuing|grilling)\b|烧烤/.test(text);
 const coffee = /\b(?:coffee|caf[eé]|latte|cappuccino|espresso)\b|咖啡/.test(text);
 const weekend = /\bweekends?\b|周末/.test(text);
 const travel = /\b(?:travel\w*|trips?|flights?|airports?|vacations?|holidays?|journeys?)\b|旅行|出行|旅游|机场/.test(text);
 const rules: Array<[boolean, string]> = [
  [park && barbecue, '公园烧烤计划'],
  [coffee && /\b(?:order\w*|please|menu|cup|buy|buying)\b|点单|点餐/.test(text), '咖啡点单沟通'],
  [weekend && travel, '周末出行讨论'],
  [barbecue, '烧烤聚会计划'],
  [/\b(?:hotels?|check[ -]?in|reservations?)\b|酒店|入住|预订/.test(text), '酒店入住沟通'],
  [/\b(?:interviews?|resumes?|job hunting)\b|面试|求职/.test(text), '求职面试交流'],
  [/\b(?:meetings?|projects?|colleagues?|work|office)\b|工作|同事|职场/.test(text), '工作职场交流'],
  [travel, '旅行出行计划'],
  [park, '公园休闲活动'],
  [coffee, '咖啡日常闲聊'],
  [weekend, '周末生活计划'],
  [/\b(?:cook\w*|recipes?|food|restaurants?|dinner|lunch|breakfast)\b|美食|做饭|餐厅/.test(text), '美食用餐交流'],
  [/\b(?:friends?|parties|party|gatherings?)\b|朋友|聚会/.test(text), '朋友聚会安排'],
  [/\b(?:movies?|films?|cinema|music|songs?|books?|reading)\b|电影|音乐|读书/.test(text), '日常兴趣分享'],
  [/\b(?:exercise|gym|running|sports?|fitness)\b|运动|健身/.test(text), '运动健身交流'],
  [/\b(?:family|parents?|children|kids)\b|家人|家庭|孩子/.test(text), '家庭生活分享'],
 ];
 const match = rules.find(([matches]) => matches);
 if (match) return match[1];
 // Unknown subjects stay natural Chinese; never copy or truncate English.
 const greetingOnly = turns.every(message => /^(?:(?:hello|hi|hey)(?: there)?|how are you(?: doing)?|i(?: am|'m|’m) (?:fine|good|great)(?: thanks)?|good (?:morning|afternoon|evening)|nice to meet you|你好|早上好)[\s!?.！，。？]*$/i.test(message.content.trim()));
 return greetingOnly || turns.length < 2 ? '日常问候与闲聊' : '日常生活交流';
}

export function resolveSessionTitle(session: { title: string; titleSource?: string; messages: TitleMessage[] }): string {
 return session.titleSource === 'manual' ? session.title : generateSessionTitle(session.messages);
}
