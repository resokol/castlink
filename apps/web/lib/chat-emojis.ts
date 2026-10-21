/** Plain Unicode stays compatible with saved chat, older clients and exports. */
export const CHAT_EMOJIS = [
  {id:'smile',value:'🙂',label:['Улыбка','Smile','微笑']},
  {id:'wink',value:'😉',label:['Подмигивание','Wink','眨眼']},
  {id:'laugh',value:'😄',label:['Смех','Laughter','大笑']},
  {id:'cool',value:'😎',label:['Круто','Cool','酷']},
  {id:'tongue',value:'😛',label:['Язык','Tongue out','吐舌']},
  {id:'blush',value:'😊',label:['Смущение','Blush','害羞']},
  {id:'surprise',value:'😮',label:['Удивление','Surprise','惊讶']},
  {id:'kiss',value:'😘',label:['Поцелуй','Kiss','亲吻']},
  {id:'sad',value:'🙁',label:['Грусть','Sad','难过']},
  {id:'cry',value:'😢',label:['Плач','Crying','哭泣']},
  {id:'angry',value:'😠',label:['Злость','Angry','生气']},
  {id:'think',value:'🤔',label:['Задумался','Thinking','思考']},
  {id:'confused',value:'😕',label:['Не понимаю','Confused','困惑']},
  {id:'skeptic',value:'🤨',label:['Скепсис','Skeptical','怀疑']},
  {id:'yawn',value:'🥱',label:['Зеваю','Yawning','打哈欠']},
  {id:'sleep',value:'😴',label:['Сплю','Sleeping','睡觉']},
  {id:'sick',value:'🤒',label:['Болею','Sick','生病']},
  {id:'devil',value:'😈',label:['Чертёнок','Little devil','小恶魔']},
  {id:'angel',value:'😇',label:['Ангел','Angel','天使']},
  {id:'flower',value:'🌼',label:['Цветок','Flower','花']},
  {id:'like',value:'👍',label:['Класс','Thumbs up','点赞']},
  {id:'clap',value:'👏',label:['Аплодисменты','Applause','鼓掌']},
  {id:'heart',value:'❤️',label:['Сердце','Heart','爱心']},
  {id:'hello',value:'👋',label:['Привет','Hello','你好']},
] as const;
export type ChatEmoji = typeof CHAT_EMOJIS[number];
export type EmojiId = ChatEmoji['id'];
export const REACTION_IDS = ['like','clap','laugh','surprise','sad','blush','heart'] as const;
export type ReactionId = typeof REACTION_IDS[number];
export const emojiById = (id: EmojiId) => CHAT_EMOJIS.find(e=>e.id===id)!;
export function splitChatEmojis(text: string): (string | ChatEmoji)[] {
  const result: (string | ChatEmoji)[] = [];let start=0,index=0;
  while(index<text.length){const emoji=CHAT_EMOJIS.find(e=>text.startsWith(e.value,index));
    if(emoji){if(index>start)result.push(text.slice(start,index));result.push(emoji);index+=emoji.value.length;start=index;}else index++;
  }
  if(start<text.length)result.push(text.slice(start));return result;
}
export function insertChatEmoji(text: string, emoji: string, start: number, end=start, limit=4000) {
  start=Math.max(0,Math.min(text.length,start));end=Math.max(start,Math.min(text.length,end));
  const next=text.slice(0,start)+emoji+text.slice(end);
  return next.length>limit?{value:text,cursor:end}:{value:next,cursor:start+emoji.length};
}
