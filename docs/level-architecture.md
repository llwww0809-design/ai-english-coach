# 全局等级接入规范

- 唯一配置源：src/lib/level-config.ts。UserLevel 为 L1～L5，默认 L3。
- 客户端页面使用 src/hooks/use-user-level.ts 的 useUserLevel()，仅 ready 后加载难度相关数据；SSR 与首屏不读取 localStorage。
- 用户选择必须调用 setUserLevel()：写入 ai_english_user_level，广播 app-level-changed（detail 为等级）。旧 english-coach.level.v1 与 CEFR 编码自动迁移。
- 新增语法、听力、发音等模块，业务请求入口必须通过 getUserLevel() 读取当前等级并作为入参。不要维护独立等级状态或存储键。
- 服务端无法读取浏览器存储：只验证客户端传入的 level，并从同一中枢获取提示词与语速配置；缺省仅使用中枢 DEFAULT_LEVEL。
- 聊天请求在 ai-client.ts 统一注入当前等级，TTS 在发起时读取当前等级。提示词等级约束同时作用于回复、角色扮演和建议。
- 主题只代表场景，topic-vocab.ts 每个主题必须具备五档独立词汇、搭配和例句；禁止用改 level 标签的方式伪造内容难度。
- 主题词 ID 含主题及等级，掌握数仅统计当前等级。每日批次按日期及等级恢复；切换等级不抹掉其他等级进度。
- 入库保存来源等级与原始例句，不因当前等级改变而重新标记。未知对话词保留原语境，不能把未知音标/释义伪装成已补全数据。
