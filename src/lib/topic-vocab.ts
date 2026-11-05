import { topicExpansions } from './topic-vocab-expansion';
import type { UserLevel } from './level-config';
export type TopicWordData = [word: string, phonetic: string, translation: string, collocations: string[], exampleEn: string, exampleZh: string];
// Curated independently for each theme and difficulty; never relabel harder examples.
const baseTopicDefinitions: Array<{ id: string; title: string; subtitle: string; category: 'daily' | 'travel' | 'work' | 'exam'; byLevel: Record<UserLevel, TopicWordData[]> }> = [
  {
    "id": "coffee-dining",
    "title": "☕ 咖啡餐饮",
    "subtitle": "点单 · 忌口沟通与结账",
    "category": "daily",
    "byLevel": {
      "L1": [
        [
          "menu",
          "/ˈmenjuː/",
          "菜单",
          [
            "see the menu",
            "lunch menu"
          ],
          "Can I see the menu?",
          "可以看看菜单吗？"
        ],
        [
          "water",
          "/ˈwɔːtər/",
          "水",
          [
            "cold water",
            "a glass of water"
          ],
          "Water, please.",
          "请给我水。"
        ],
        [
          "order",
          "/ˈɔːrdər/",
          "点单",
          [
            "order food",
            "order a coffee"
          ],
          "Can I order now?",
          "我现在可以点单吗？"
        ],
        [
          "bill",
          "/bɪl/",
          "账单",
          [
            "pay the bill",
            "the bill please"
          ],
          "The bill, please.",
          "请结账。"
        ]
      ],
      "L2": [
        [
          "decaf",
          "/ˈdiːkæf/",
          "低因咖啡",
          [
            "decaf coffee",
            "a decaf latte"
          ],
          "Do you have decaf coffee?",
          "你们有低因咖啡吗？"
        ],
        [
          "refill",
          "/ˈriːfɪl/",
          "续杯",
          [
            "a free refill",
            "get a refill"
          ],
          "Can I get a refill, please?",
          "可以帮我续杯吗？"
        ]
      ],
      "L3": [
        [
          "on the side",
          "/ɑːn ðə saɪd/",
          "另放一边",
          [
            "sauce on the side",
            "dressing on the side"
          ],
          "Could I get the dressing on the side?",
          "沙拉酱可以单独放吗？"
        ],
        [
          "split the check",
          "/splɪt ðə tʃek/",
          "分开结账",
          [
            "split the check evenly",
            "split the check three ways"
          ],
          "Can we split the check three ways?",
          "我们可以三个人分开结账吗？"
        ]
      ],
      "L4": [
        [
          "dietary restrictions",
          "/ˈdaɪəteri rɪˈstrɪkʃənz/",
          "饮食限制",
          [
            "accommodate dietary restrictions",
            "specific dietary restrictions"
          ],
          "Could you accommodate dietary restrictions without changing the whole dish?",
          "你们能在不改变整道菜的情况下照顾饮食限制吗？"
        ],
        [
          "substitute with oat milk",
          "/ˈsʌbstɪtuːt wɪð oʊt mɪlk/",
          "换成燕麦奶",
          [
            "substitute dairy with oat milk",
            "substitute with oat milk at no charge"
          ],
          "Could you substitute with oat milk if it works with this blend?",
          "如果适合这款拼配，能换成燕麦奶吗？"
        ]
      ],
      "L5": [
        [
          "an acquired taste",
          "/ən əˈkwaɪərd teɪst/",
          "需要慢慢适应的口味",
          [
            "something of an acquired taste",
            "become an acquired taste"
          ],
          "The earthy aftertaste is an acquired taste, though it grows on you.",
          "那种泥土般的余味需要适应，不过会越喝越喜欢。"
        ],
        [
          "palate",
          "/ˈpælət/",
          "味觉；口味",
          [
            "a discerning palate",
            "cleanse the palate"
          ],
          "While the acidity might overwhelm some palates, it cuts beautifully through the richness.",
          "虽然有些人会觉得偏酸，但它恰好化解了浓腻。"
        ]
      ]
    }
  },
  {
    "id": "airport-transit",
    "title": "✈️ 机场出行",
    "subtitle": "值机 · 转机与旅途沟通",
    "category": "travel",
    "byLevel": {
      "L1": [
        [
          "passport",
          "/ˈpæspɔːrt/",
          "护照",
          [
            "my passport",
            "show a passport"
          ],
          "Here is my passport.",
          "这是我的护照。"
        ],
        [
          "ticket",
          "/ˈtɪkɪt/",
          "机票；车票",
          [
            "a plane ticket",
            "buy a ticket"
          ],
          "Here is my ticket.",
          "这是我的票。"
        ],
        [
          "gate",
          "/ɡeɪt/",
          "登机口",
          [
            "gate ten",
            "at the gate"
          ],
          "Where is gate ten?",
          "十号登机口在哪里？"
        ]
      ],
      "L2": [
        [
          "luggage",
          "/ˈlʌɡɪdʒ/",
          "行李",
          [
            "check luggage",
            "hand luggage"
          ],
          "Where can I check my luggage?",
          "我可以在哪里托运行李？"
        ],
        [
          "delayed",
          "/dɪˈleɪd/",
          "延误的",
          [
            "a delayed flight",
            "be delayed"
          ],
          "Is our flight delayed?",
          "我们的航班延误了吗？"
        ]
      ],
      "L3": [
        [
          "connecting flight",
          "/kəˈnektɪŋ flaɪt/",
          "转机航班",
          [
            "catch a connecting flight",
            "miss a connecting flight"
          ],
          "Will I have time to catch my connecting flight?",
          "我来得及赶上转机航班吗？"
        ],
        [
          "check in",
          "/tʃek ɪn/",
          "办理登机",
          [
            "check in online",
            "check in at the counter"
          ],
          "I checked in online, but I still need to drop off my bag.",
          "我已经网上值机了，但还需要托运行李。"
        ]
      ],
      "L4": [
        [
          "customs declaration",
          "/ˈkʌstəmz ˌdekləˈreɪʃən/",
          "海关申报",
          [
            "complete a customs declaration",
            "customs declaration form"
          ],
          "Do I need to complete a customs declaration if I only have personal items?",
          "如果只带个人物品，我需要填写海关申报吗？"
        ],
        [
          "transit layover",
          "/ˈtrænzɪt ˈleɪoʊvər/",
          "中转停留",
          [
            "an overnight transit layover",
            "a lengthy transit layover"
          ],
          "Can I leave the airport during my transit layover, provided I have a visa?",
          "有签证的话，中转停留期间可以离开机场吗？"
        ]
      ],
      "L5": [
        [
          "flight compensation",
          "/flaɪt ˌkɑːmpənˈseɪʃən/",
          "航班赔偿",
          [
            "claim flight compensation",
            "eligibility for flight compensation"
          ],
          "Given that the cancellation was within the airline’s control, am I entitled to flight compensation?",
          "既然取消原因在航空公司控制范围内，我是否有权获得航班赔偿？"
        ],
        [
          "rerouting",
          "/ˌriːˈruːtɪŋ/",
          "改道；重新安排航线",
          [
            "request rerouting",
            "rerouting at no extra cost"
          ],
          "Rather than accepting a refund, I would prefer rerouting at the earliest opportunity.",
          "与其退款，我更希望尽早重新安排航线。"
        ]
      ]
    }
  },
  {
    "id": "renting-home",
    "title": "🏠 海外租房",
    "subtitle": "租约 · 报修与押金",
    "category": "daily",
    "byLevel": {
      "L1": [
        [
          "room",
          "/ruːm/",
          "房间",
          [
            "a small room",
            "my room"
          ],
          "Is this my room?",
          "这是我的房间吗？"
        ],
        [
          "key",
          "/kiː/",
          "钥匙",
          [
            "a door key",
            "my key"
          ],
          "I need a key.",
          "我需要一把钥匙。"
        ]
      ],
      "L2": [
        [
          "deposit",
          "/dɪˈpɑːzɪt/",
          "押金",
          [
            "pay a deposit",
            "get a deposit back"
          ],
          "When can I get my deposit back?",
          "我什么时候能拿回押金？"
        ],
        [
          "leak",
          "/liːk/",
          "漏水",
          [
            "fix a leak",
            "a water leak"
          ],
          "There is a leak under the sink.",
          "水槽下面漏水了。"
        ]
      ],
      "L3": [
        [
          "move in",
          "/muːv ɪn/",
          "搬入",
          [
            "move in next week",
            "ready to move in"
          ],
          "Can we move in before the end of the month?",
          "我们能在月底之前搬进来吗？"
        ],
        [
          "wear and tear",
          "/wer ən ter/",
          "正常使用损耗",
          [
            "normal wear and tear",
            "allow for wear and tear"
          ],
          "Does the deposit cover normal wear and tear?",
          "押金要扣除正常使用损耗吗？"
        ]
      ],
      "L4": [
        [
          "maintenance request",
          "/ˈmeɪntənəns rɪˈkwest/",
          "维修申请",
          [
            "submit a maintenance request",
            "an urgent maintenance request"
          ],
          "I submitted a maintenance request last week, but the heating still is not working.",
          "我上周提交了维修申请，但暖气仍然不工作。"
        ],
        [
          "subletting",
          "/ˌsʌbˈletɪŋ/",
          "转租",
          [
            "permission for subletting",
            "a subletting agreement"
          ],
          "Does the lease permit subletting if I need to relocate temporarily?",
          "如果我需要临时搬走，租约允许转租吗？"
        ]
      ],
      "L5": [
        [
          "fair wear and tear",
          "/fer wer ən ter/",
          "合理自然损耗",
          [
            "account for fair wear and tear",
            "deductions beyond fair wear and tear"
          ],
          "I would dispute deductions for fair wear and tear, particularly given the age of the furnishings.",
          "我会对正常损耗的扣款提出异议，尤其考虑到家具已经很旧。"
        ],
        [
          "habitability",
          "/ˌhæbɪtəˈbɪləti/",
          "适居性",
          [
            "minimum habitability standards",
            "a habitability concern"
          ],
          "Persistent damp raises a habitability concern that cosmetic repairs alone cannot address.",
          "持续潮湿涉及居住条件问题，单纯表面修补无法解决。"
        ]
      ]
    }
  },
  {
    "id": "work-chat",
    "title": "💼 职场沟通",
    "subtitle": "邮件 · 请假与工作交接",
    "category": "work",
    "byLevel": {
      "L1": [
        [
          "help",
          "/help/",
          "帮助",
          [
            "need help",
            "help me"
          ],
          "Can you help me?",
          "你能帮我吗？"
        ],
        [
          "email",
          "/ˈiːmeɪl/",
          "电子邮件",
          [
            "send an email",
            "read an email"
          ],
          "Please send me an email.",
          "请给我发邮件。"
        ]
      ],
      "L2": [
        [
          "available",
          "/əˈveɪləbəl/",
          "有空的",
          [
            "available today",
            "available for a call"
          ],
          "Are you available for a quick call?",
          "你有空快速通个电话吗？"
        ],
        [
          "day off",
          "/deɪ ɔːf/",
          "休假一天",
          [
            "take a day off",
            "request a day off"
          ],
          "Can I take a day off on Friday?",
          "我能周五请一天假吗？"
        ]
      ],
      "L3": [
        [
          "follow up",
          "/ˈfɑːloʊ ʌp/",
          "跟进",
          [
            "follow up on an email",
            "follow up with a client"
          ],
          "I will follow up with the client after lunch.",
          "我午饭后会跟进客户。"
        ],
        [
          "hand over",
          "/hænd ˈoʊvər/",
          "交接",
          [
            "hand over a project",
            "hand over to a colleague"
          ],
          "Let me hand over the project before I go on leave.",
          "我休假前先把项目交接一下。"
        ]
      ],
      "L4": [
        [
          "bandwidth",
          "/ˈbændwɪdθ/",
          "工作精力；可用时间",
          [
            "have the bandwidth",
            "limited bandwidth"
          ],
          "I would love to help, but I do not have the bandwidth this week.",
          "我很想帮忙，但这周实在抽不出精力。"
        ],
        [
          "manage expectations",
          "/ˈmænɪdʒ ˌekspekˈteɪʃənz/",
          "管理预期",
          [
            "manage client expectations",
            "manage expectations early"
          ],
          "We should manage expectations before we commit to the revised timeline.",
          "在承诺新时间表之前，我们应该先管理好预期。"
        ]
      ],
      "L5": [
        [
          "read the room",
          "/riːd ðə ruːm/",
          "察言观色",
          [
            "learn to read the room",
            "read the room before speaking"
          ],
          "Reading the room, I decided to raise the concern privately rather than derail the update.",
          "察觉现场气氛后，我决定私下提出担忧，避免打断汇报。"
        ],
        [
          "tacit understanding",
          "/ˈtæsɪt ˌʌndərˈstændɪŋ/",
          "默契；心照不宣",
          [
            "a tacit understanding",
            "reach a tacit understanding"
          ],
          "We had a tacit understanding that urgent issues would be escalated, although nobody had formalized it.",
          "我们默契地认为紧急问题要上报，尽管没有形成正式规定。"
        ]
      ]
    }
  },
  {
    "id": "exam-speaking",
    "title": "🎓 口语观点表达",
    "subtitle": "学习生活 · 论点与讨论",
    "category": "exam",
    "byLevel": {
      "L1": [
        [
          "like",
          "/laɪk/",
          "喜欢",
          [
            "like music",
            "like sports"
          ],
          "I like music.",
          "我喜欢音乐。"
        ],
        [
          "study",
          "/ˈstʌdi/",
          "学习",
          [
            "study English",
            "study at home"
          ],
          "I study English at home.",
          "我在家学英语。"
        ]
      ],
      "L2": [
        [
          "opinion",
          "/əˈpɪnjən/",
          "看法",
          [
            "in my opinion",
            "share an opinion"
          ],
          "In my opinion, reading is fun.",
          "我觉得阅读很有趣。"
        ],
        [
          "reason",
          "/ˈriːzən/",
          "原因",
          [
            "a good reason",
            "the main reason"
          ],
          "The main reason is the low cost.",
          "主要原因是成本低。"
        ]
      ],
      "L3": [
        [
          "point out",
          "/pɔɪnt aʊt/",
          "指出",
          [
            "point out a problem",
            "point out a benefit"
          ],
          "I would like to point out one benefit of studying abroad.",
          "我想指出留学的一个好处。"
        ],
        [
          "depend on",
          "/dɪˈpend ɑːn/",
          "取决于",
          [
            "depend on the situation",
            "depend on your goal"
          ],
          "The best choice depends on your goal.",
          "最佳选择取决于你的目标。"
        ]
      ],
      "L4": [
        [
          "counterargument",
          "/ˈkaʊntərˌɑːrɡjəmənt/",
          "反方论点",
          [
            "address a counterargument",
            "a convincing counterargument"
          ],
          "A convincing counterargument is that remote learning can limit social interaction.",
          "一个有力的反方论点是远程学习可能限制社交互动。"
        ],
        [
          "weigh up",
          "/weɪ ʌp/",
          "权衡",
          [
            "weigh up the benefits",
            "weigh up the options"
          ],
          "We need to weigh up the benefits against the potential drawbacks.",
          "我们需要权衡好处和潜在弊端。"
        ]
      ],
      "L5": [
        [
          "false dichotomy",
          "/fɔːls daɪˈkɑːtəmi/",
          "非此即彼的错误二分",
          [
            "create a false dichotomy",
            "reject a false dichotomy"
          ],
          "Framing the debate as freedom versus security creates a false dichotomy that obscures workable compromises.",
          "把争论框定为自由与安全二选一，会掩盖可行的折中方案。"
        ],
        [
          "qualify a claim",
          "/ˈkwɑːlɪfaɪ ə kleɪm/",
          "限定论断的适用范围",
          [
            "qualify a broad claim",
            "qualify a claim with evidence"
          ],
          "I would qualify that claim: the evidence is persuasive, yet it does not establish causation.",
          "我会给这一论断加上限定：证据很有说服力，但并未确立因果关系。"
        ]
      ]
    }
  },
  {
    "id": "business-meetings",
    "title": "📈 商务会议",
    "subtitle": "汇报 · 提案与协商",
    "category": "work",
    "byLevel": {
      "L1": [
        [
          "plan",
          "/plæn/",
          "计划",
          [
            "a new plan",
            "make a plan"
          ],
          "Here is our plan.",
          "这是我们的计划。"
        ],
        [
          "team",
          "/tiːm/",
          "团队",
          [
            "our team",
            "a small team"
          ],
          "Our team can help.",
          "我们团队可以帮忙。"
        ]
      ],
      "L2": [
        [
          "meeting",
          "/ˈmiːtɪŋ/",
          "会议",
          [
            "have a meeting",
            "a team meeting"
          ],
          "Can we have a meeting tomorrow?",
          "我们明天能开个会吗？"
        ],
        [
          "report",
          "/rɪˈpɔːrt/",
          "报告",
          [
            "read a report",
            "a sales report"
          ],
          "The sales report is ready.",
          "销售报告准备好了。"
        ]
      ],
      "L3": [
        [
          "bring up",
          "/brɪŋ ʌp/",
          "提出话题",
          [
            "bring up an issue",
            "bring up a question"
          ],
          "Can I bring up one issue before we finish?",
          "结束前我能提一个问题吗？"
        ],
        [
          "work out",
          "/wɜːrk aʊt/",
          "想出；解决",
          [
            "work out a plan",
            "work out the details"
          ],
          "Let us work out the details after the meeting.",
          "我们会后再商量细节吧。"
        ]
      ],
      "L4": [
        [
          "trade-off",
          "/ˈtreɪd ɔːf/",
          "权衡；取舍",
          [
            "make a trade-off",
            "a reasonable trade-off"
          ],
          "There is a trade-off between launching quickly and getting every detail right.",
          "快速上线和完善每个细节之间需要取舍。"
        ],
        [
          "align on",
          "/əˈlaɪn ɑːn/",
          "就……达成一致",
          [
            "align on priorities",
            "align on a timeline"
          ],
          "Before we discuss costs, can we align on the main priorities?",
          "讨论成本前，我们能先就主要优先事项达成一致吗？"
        ]
      ],
      "L5": [
        [
          "second-order effects",
          "/ˌsekənd ˈɔːrdər ɪˈfekts/",
          "间接连锁影响",
          [
            "anticipate second-order effects",
            "unintended second-order effects"
          ],
          "Although the savings look attractive, we should account for second-order effects on retention.",
          "虽然节约的成本很吸引人，但也应考虑对员工留任的间接影响。"
        ],
        [
          "move the needle",
          "/muːv ðə ˈniːdəl/",
          "带来实质进展",
          [
            "really move the needle",
            "move the needle on growth"
          ],
          "Unless we tackle the underlying bottleneck, another round of optimization is unlikely to move the needle.",
          "除非解决根本瓶颈，否则再一轮优化也不太可能带来实质进展。"
        ]
      ]
    }
  }
];

// Append rows so IDs already stored on this device keep referring to the same words.
export const topicDefinitions = baseTopicDefinitions.map(topic => ({
  ...topic,
  byLevel: Object.fromEntries(
    (Object.keys(topic.byLevel) as UserLevel[]).map(level => [
      level, [...topic.byLevel[level], ...(topicExpansions[topic.id]?.[level] ?? [])],
    ]),
  ) as Record<UserLevel, TopicWordData[]>,
}));
