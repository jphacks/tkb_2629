import type { PublicReviewDistribution, ReviewPageRange } from './api';

export type ReviewBin = ReviewPageRange & { count: number };

export function reviewBins(totalPages: number, columns: number, distribution: PublicReviewDistribution, fixed = false): ReviewBin[] {
  if (!Number.isSafeInteger(totalPages) || totalPages < 1 || !Number.isInteger(columns) || columns < 1) {
    throw new Error('本の総ページ数または表示幅を確認できません。');
  }
  if (distribution.items.some((item) => item.page_number > totalPages)) {
    throw new Error('総ページ数を超えるしおりがあります。本の情報を確認してください。');
  }
  const count = fixed ? columns : Math.min(totalPages, columns);
  const bins = Array.from({ length: count }, (_, index) => ({
    start: Math.floor(index * totalPages / count) + 1,
    end: Math.floor((index + 1) * totalPages / count),
    count: 0,
  }));
  let index = 0;
  for (const item of distribution.items) {
    while (bins[index]!.end < item.page_number) index += 1;
    bins[index]!.count += item.review_count;
  }
  return bins.reverse();
}
