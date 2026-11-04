/** Local-only responses. Replace this service when a real provider is introduced. */
export function getMockTeacherReply(text: string, turn: number): string {
 if (/\b(i am|i'm) agree\b/i.test(text)) return 'Good effort! A more natural way to say that is “I agree.” Try using it in a sentence about something you enjoy.';
 if (/\b(hello|hi|hey)\b/i.test(text)) return 'Hi there! I’m happy you’re here. Let’s start small: how has your day been?';
 if (/\b(tired|sad|nervous)\b/i.test(text)) return 'Thank you for sharing. Take your time — a short sentence is a great start. What helps you feel better?';
 if (/\b(coffee|food|cook|eat)\b/i.test(text)) return 'Nice topic! Add one detail to your answer, such as “I enjoy it because…” What is your favorite thing about it?';
 const replies = ['Great effort! Try adding a reason with “because” to make your answer more detailed.', 'You’re building a good habit! Try describing one thing you did today using the past tense.', 'Keep going! Try asking me a question with “What” or “How” to keep the conversation flowing.'];
 return replies[turn % replies.length];
}
