export type DemoBookmark = {
  page: number;
  emotion: string;
  color: string;
  content: string;
};

export const demoBook = {
  title: '雨あがりの図書室',
  author: 'Re:Read デモ作品',
  totalPages: 200,
};

export const demoChoices: readonly DemoBookmark[] = [
  { page: 120, emotion: '喜び', color: '#E6C84D', content: '手紙の返事が届いて、二人がまた話せることがうれしかった' },
  { page: 120, emotion: '悲しみ', color: '#8073CC', content: '返事を待ち続けていた時間を想像して、胸が締めつけられた' },
  { page: 120, emotion: '期待', color: '#F2AD62', content: 'この手紙をきっかけに、二人の関係が変わっていく予感がした' },
];

export const demoOtherBookmark: DemoBookmark = {
  page: 120, emotion: '信頼', color: '#7EB56B', content: '返事が来ると信じて待っていたことに、相手への深い信頼を感じた',
};

export const demoBookmarks: Record<'mine' | 'others', readonly DemoBookmark[]> = {
  mine: [
    { page: 24, emotion: '期待', color: '#F2AD62', content: '閉じていた図書室の扉が開く場面に、これから何かが始まりそうでわくわくした' },
    { page: 96, emotion: '悲しみ', color: '#8073CC', content: '友人が残した手紙を読む場面で、言えなかった言葉の重さが伝わってきた' },
    { page: 180, emotion: '喜び', color: '#E6C84D', content: '最後に二人が同じ本を手に取る場面で、離れていた時間がつながった気がした' },
  ],
  others: [
    { page: 24, emotion: '驚き', color: '#64BFA8', content: '図書室の中に手紙が隠されていた展開が意外だった' },
    { page: 96, emotion: '信頼', color: '#7EB56B', content: '手紙をずっと大事にしていたことに、二人の強い絆を感じた' },
    { page: 180, emotion: '期待', color: '#F2AD62', content: 'ここから二人の新しい物語が始まりそうで、続きが気になった' },
  ],
};
