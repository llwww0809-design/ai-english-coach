# AI English Coach

Next.js + React + TypeScript 的个人英语学习前端。全部为模拟数据，无付费 API。

## 启动

安装 Node.js 后，在本目录执行：

```sh
npm install
npm run dev
```

打开 http://127.0.0.1:3000 。

## 检查

```sh
npm run typecheck
npm run build
```

## 结构

- src/app/page.tsx：首页与模拟交互
- src/app/globals.css：响应式样式
- src/app/layout.tsx：页面基础布局
- src/lib/mock-data.ts：预设单词和学习数据

本次练习数据只在页面内保留，刷新后恢复。后续逐步接入本地学习记录、语音和 AI 功能。

## 第二阶段：AI 英语老师

访问 /teacher，或点击首页 AI 英语老师入口。支持消息历史、模拟等待、Enter 发送、Shift+Enter 换行。麦克风仅提示，未调用录音权限。模拟回复在 src/lib/mock-teacher.ts 中维护；聊天记录自动保存在当前浏览器的 localStorage。顶部“新对话”经确认后重置记录；取消则保留记录。浏览器清理网站数据或使用不同地址/端口时，记录不会共享。

## 情景对话

/scenarios：场景选择；/scenarios/cafe、/scenarios/airport、/scenarios/hotel：角色扮演。每个场景先展示示范，发送后按预设台词推进，不进行真实 AI 判断。AI 台词可使用浏览器英语朗读；重练需要确认。场景练习暂不持久化，刷新重置，AI 老师的本地记录不受影响。

## 单词复习

/words 提供六个生活词汇。翻卡查看释义、例句与翻译，按钮调用浏览器英语朗读。没记住会排到本轮末尾，已掌握才推进完成进度；全部掌握后展示结算，可再练同组。此阶段复习进度刷新后重置。

## 学习数据联动

单词掌握状态、待复习队列和北京时间每日去重学习记录保存在 localStorage 的 english-coach.learning.v1。首页展示真实待复习数量、累计不同词汇量、今日进度与本周每日掌握词数。重复练习不重复计入同日数量。复习页底部可确认重置单词学习数据，不影响聊天记录；同地址标签页通过 storage 事件同步。浏览器存储失败会显示提示。
"# ai-english-coach" 
"# ai-english-coach" 
"# ai-english-coach" 
