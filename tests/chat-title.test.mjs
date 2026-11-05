import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTs } from './load-ts.mjs';
const { generateSessionTitle, resolveSessionTitle } = await loadTs(new URL('../src/lib/chat-title.ts', import.meta.url));
const user = content => ({ role: 'user', content });

test('greetings remain Chinese and ignore the assistant opening topic', () => {
 for (const greeting of ['hello', 'hi!', 'how are you?', 'good morning']) {
  assert.equal(generateSessionTitle([{ role: 'assistant', content: 'Do you like coffee?' }, user(greeting)]), '日常问候与闲聊');
 }
 assert.equal(generateSessionTitle([user('hi'), user('How are you?')]), '日常问候与闲聊');
});

test('a concrete subject replaces the greeting title, including compound topics across turns', () => {
 assert.equal(generateSessionTitle([user('hello'), user('Let us have a BBQ in the park.')]), '公园烧烤计划');
 assert.equal(generateSessionTitle([user('I am going to the park.'), user('We will have a barbecue.')]), '公园烧烤计划');
 assert.equal(generateSessionTitle([user('Can I order a coffee please?')]), '咖啡点单沟通');
 assert.equal(generateSessionTitle([user('We plan a trip this weekend.')]), '周末出行讨论');
 assert.equal(generateSessionTitle([user('This is a workday greeting.')]), '日常问候与闲聊');
});

test('unknown topics never leak English fragments; old auto titles migrate and manual titles persist', () => {
 const messages = [user('How are you?'), user('I am thinking about something unusual.')];
 assert.match(generateSessionTitle(messages), /^[\u4e00-\u9fff]{4,8}$/u);
 assert.equal(resolveSessionTitle({ title: '关于how are', messages: [user('how are you')] }), '日常问候与闲聊');
 assert.equal(resolveSessionTitle({ title: '我的口语笔记', titleSource: 'manual', messages }), '我的口语笔记');
 assert.equal(generateSessionTitle([]), '新对话');
});
