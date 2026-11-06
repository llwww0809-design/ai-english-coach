import type { SlowArticle } from './listening-storage';

const seed = (id: string, level: SlowArticle['level'], titleEn: string, titleZh: string, category: string, lines: [string, string][]): SlowArticle => {
  const words = lines.reduce((sum, [en]) => sum + en.split(/\s+/).length, 0);
  const seconds = Math.round(words / 108 * 60);
  return { id, level, titleEn, titleZh, category, audioSpeed: 0.8, duration: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`, createdAt: '2026-11-01T00:00:00.000Z', sentences: lines.map(([en, zh], index) => ({ id: `${id}-${index}`, en, zh })) };
};

export const listeningSeeds: SlowArticle[] = [
  seed('seed-coffee', 'L1', 'Morning Coffee', '晨间咖啡', '日常', [
    ['It is a new day, and I am at home.', '新的一天开始了，我在家里。'],
    ['I open my eyes and look at the blue sky.', '我睁开眼睛，看看蓝色的天空。'],
    ['My little cat sits next to me on the bed.', '我的小猫坐在床上，就在我身边。'],
    ['I get up and put some water in a cup.', '我起床，往杯子里倒些水。'],
    ['I make hot coffee and put milk in it.', '我冲好热咖啡，在里面加上牛奶。'],
    ['I sit by the window and eat some bread.', '我坐在窗边，吃一点面包。'],
    ['The coffee is warm, and the house is quiet.', '咖啡暖暖的，屋里很安静。'],
    ['I take a small drink and smile at my cat.', '我喝了一小口，对小猫笑了笑。'],
    ['I have time for this small, happy start today.', '今天，我有时间享受这小小的快乐开场。'],
  ]),
  seed('seed-park', 'L1', 'A Walk in the Park', '公园散步', '自然', [
    ['I go to the park with my friend today.', '今天我和朋友一起去公园。'],
    ['The sun is out, and the air feels good.', '太阳出来了，空气让人很舒服。'],
    ['We walk on a small road by the trees.', '我们沿着树旁的一条小路走。'],
    ['I see a little dog and a big white bird.', '我看到一只小狗和一只大白鸟。'],
    ['A man sits on a chair and reads a book.', '一位男士坐在椅子上看书。'],
    ['We stop by the water and look at the fish.', '我们在水边停下，看看小鱼。'],
    ['My friend gives me an apple and some water.', '朋友给我一个苹果和一些水。'],
    ['We talk, eat, and sit in the sun for a little.', '我们聊聊天，吃点东西，晒一会儿太阳。'],
    ['It is a good day for a slow walk together.', '今天很适合一起慢慢散步。'],
  ]),
  seed('seed-market', 'L2', 'The Saturday Market', '周六小集市', '生活', [
    ['On Saturday morning, I visit a small market near my home.', '周六早上，我去家附近的小集市。'],
    ['There are fresh apples, warm bread, and flowers in many colors.', '那里有新鲜苹果、温热面包和五颜六色的花。'],
    ['I usually bring my own bag and a short shopping list.', '我通常自带袋子和一张简短的购物清单。'],
    ['Today I want some tomatoes for dinner and a little cheese.', '今天我想买些晚餐用的番茄和一点奶酪。'],
    ['The woman at the fruit stand asks me about my week.', '水果摊的女士问我这一周过得如何。'],
    ['We have a friendly chat while she puts everything in my bag.', '她把东西装进我的袋子时，我们友好地聊了几句。'],
    ['Before going home, I buy a small cup of orange juice.', '回家前，我买了一小杯橙汁。'],
    ['A simple morning at the market makes my weekend feel special.', '集市里简单的早晨，让我的周末变得特别。'],
  ]),
  seed('seed-rain', 'L3', 'A Rainy Afternoon', '雨天的小小留白', '治愈', [
    ['I had planned to go out, but the rain changed my mind.', '我本来打算出门，却因为下雨改变了主意。'],
    ['Instead of rushing around, I decided to slow down for once.', '我决定难得放慢一下，而不是忙个不停。'],
    ['I put on some quiet music and made a pot of tea.', '我放了轻柔的音乐，泡了一壶茶。'],
    ['Outside the window, people hurried past with bright umbrellas.', '窗外，人们撑着色彩鲜艳的伞匆匆走过。'],
    ['I picked up a book I had been meaning to finish.', '我拿起一本一直想读完的书。'],
    ['After a few pages, I caught up with an old friend online.', '看了几页后，我在网上和老朋友聊了近况。'],
    ['We laughed about nothing much, and the afternoon slipped by.', '我们随意说笑，下午就这样悄悄过去。'],
    ['Sometimes a change of plans turns out to be exactly what you need.', '有时候，计划的改变恰好就是你需要的。'],
  ]),
  seed('seed-garden', 'L4', 'A Small Garden', '阳台上的耐心', '自然', [
    ['When I started a balcony garden, I expected instant results and perfect leaves.', '开始种阳台小花园时，我期待立竿见影和完美的叶子。'],
    ['Instead, I found myself learning to notice tiny changes from one morning to the next.', '结果，我学会了留意每天早晨那些微小的变化。'],
    ['Some plants thrived, while others needed far more attention than I had imagined.', '有些植物长势很好，有些却比想象中需要更多照料。'],
    ['A neighbor suggested moving the herbs away from the harsh afternoon sunlight.', '邻居建议我把香草移开，避开午后强烈的阳光。'],
    ['Once I stopped trying to control everything, taking care of them became surprisingly relaxing.', '不再试图控制一切后，照顾它们竟变得十分放松。'],
    ['Even a handful of fresh leaves could turn an ordinary dinner into something special.', '哪怕一小把鲜叶，也能让普通晚餐多一份特别。'],
    ['The garden reminded me that progress rarely follows the schedule we set for it.', '小花园提醒我，进步很少遵循我们设定的时间表。'],
    ['It often arrives quietly, provided we keep showing up and paying attention.', '只要持续投入并用心观察，进步往往会悄然而至。'],
  ]),
  seed('seed-pause', 'L5', 'The Art of a Small Pause', '停顿的艺术', '治愈', [
    ['In a culture that treats busyness as a badge of honor, pausing can feel almost rebellious.', '在把忙碌当作荣誉的文化中，停下来几乎像是一种叛逆。'],
    ['We fill every spare moment, as though an unclaimed minute were an opportunity wasted.', '我们塞满每段空闲，仿佛留白的一分钟就是浪费机会。'],
    ['Yet attention, unlike a calendar, cannot be stretched indefinitely without losing its shape.', '然而注意力不像日程表，无法无限拉长而不变形。'],
    ['A brief walk without a destination can loosen thoughts that have been tied in knots.', '没有目的地的短暂散步，能让纠结成团的思绪松动。'],
    ['The point is not to optimize the break, but to step outside the habit of optimizing.', '重点不是优化休息，而是暂时走出事事优化的习惯。'],
    ['That distinction sounds subtle, though it changes the texture of an ordinary afternoon.', '这个区别听起来细微，却能改变普通下午的质感。'],
    ['Clarity sometimes emerges when we stop insisting that every moment produce something measurable.', '当我们不再要求每一刻都产出可衡量的成果时，清晰的思路反而会浮现。'],
    ['A pause, then, is less an escape from life than a way of inhabiting it more fully.', '如此看来，停顿并非逃离生活，而是更充分地置身其中。'],
  ]),
];
