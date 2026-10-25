import { StyleSheet, Text, View } from 'react-native';

export type BookCoverProps = { title?: string; author?: string; color?: string; paletteIndex?: number | null; patternIndex?: number | null; compact?: boolean; large?: boolean; grid?: boolean };

export const coverPalettes = [
  { name: 'ラベンダー', base: '#E8D8F4', ink: '#563A70', ornament: '#BE9AD9' },
  { name: 'ミント', base: '#D4E8E3', ink: '#254F49', ornament: '#8BBBAD' },
  { name: 'ピーチ', base: '#F3DFCF', ink: '#68452F', ornament: '#D5A17E' },
  { name: 'ブルー', base: '#D9E4F3', ink: '#354D72', ornament: '#9AB2D4' },
  { name: 'ローズ', base: '#F0D9E1', ink: '#713C50', ornament: '#CC98AC' },
  { name: 'オリーブ', base: '#E9E5C9', ink: '#535037', ornament: '#B9B27B' },
  { name: 'コーラル', base: '#F4D2CC', ink: '#723B34', ornament: '#D79587' },
  { name: 'グレー', base: '#DEE0E8', ink: '#3F465B', ornament: '#A5ABBF' },
] as const;
export const coverPatterns = ['サークル', 'ストライプ', 'アーチ', 'ダイヤ'] as const;

export function BookCover({ title = '本のタイトル', author = '著者名', color, paletteIndex, patternIndex, compact = false, large = false, grid = false }: BookCoverProps) {
  let hash = 2166136261;
  for (const character of `${title.normalize('NFC')}\0${author.normalize('NFC')}`) {
    hash = Math.imul(hash ^ character.codePointAt(0)!, 16777619) >>> 0;
  }
  const palette = coverPalettes[paletteIndex ?? hash % coverPalettes.length]!;
  const pattern = patternIndex ?? Math.floor(hash / coverPalettes.length) % coverPatterns.length;
  const ink = color ? coverTextColor(color) : palette.ink;
  const ornament = color ? ink : palette.ornament;
  return (
    <View style={[styles.cover, { backgroundColor: color ?? palette.base }, compact && styles.compact, large && styles.large, grid && styles.grid]}>
      <View pointerEvents="none" accessible={false} style={[styles.decoration, color && { opacity: 0.25 }]}>
        {pattern === 0 && <>
          <View style={[styles.disc, { backgroundColor: ornament }]} />
          <View style={[styles.horizon, { backgroundColor: ink }]} />
        </>}
        {pattern === 1 && [0, 1, 2].map((index) => (
          <View key={index} style={[styles.stripe, { backgroundColor: ornament, left: `${15 + index * 30}%` }]} />
        ))}
        {pattern === 2 && <>
          <View style={[styles.arch, { borderColor: ornament }]} />
          <View style={[styles.smallDisc, { backgroundColor: ink }]} />
        </>}
        {pattern === 3 && <>
          <View style={[styles.diamond, { backgroundColor: ornament }]} />
          <View style={[styles.diamondInset, { borderColor: ink }]} />
        </>}
      </View>
      <View pointerEvents="none" style={styles.spine} />
      <View style={styles.copy}>
        <Text numberOfLines={3} style={[styles.coverTitle, { color: ink }, compact && styles.compactTitle]}>{title}</Text>
        <Text numberOfLines={1} style={[styles.author, { color: ink }, compact && styles.compactAuthor]}>{author}</Text>
      </View>
    </View>
  );
}

export function coverTextColor(hex: string): string {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
  return luminance > 0.179 ? '#000000' : '#FFFFFF';
}

const styles = StyleSheet.create({
  cover: { borderRadius: 4, height: 95, overflow: 'hidden', width: 66 },
  compact: { height: 72, width: 50 },
  large: { height: 140, width: 94 },
  grid: { height: 140, width: 94 },
  copy: { padding: 8, paddingLeft: 10 },
  coverTitle: { fontSize: 9, fontWeight: '700', lineHeight: 12 },
  compactTitle: { fontSize: 7, lineHeight: 9 },
  author: { fontSize: 6, marginTop: 4 },
  compactAuthor: { fontSize: 5 },
  spine: { backgroundColor: 'rgba(0, 0, 0, 0.08)', bottom: 0, left: 0, top: 0, width: 4 },
  decoration: { bottom: 0, height: '48%', left: 0, overflow: 'hidden', position: 'absolute', right: 0 },
  disc: { borderRadius: 100, height: '80%', width: '65%', position: 'absolute', right: '-8%', top: '2%' },
  horizon: { bottom: 0, height: '28%', left: 0, opacity: 0.25, position: 'absolute', width: '100%' },
  stripe: { bottom: '-30%', height: '150%', position: 'absolute', transform: [{ rotate: '25deg' }], width: '18%' },
  arch: { borderRadius: 100, borderWidth: 10, bottom: '-45%', height: '130%', left: '8%', position: 'absolute', width: '84%' },
  smallDisc: { borderRadius: 100, height: '20%', left: '42%', opacity: 0.6, position: 'absolute', top: '40%', width: '16%' },
  diamond: { height: '95%', left: '20%', position: 'absolute', top: '35%', transform: [{ rotate: '45deg' }], width: '70%' },
  diamondInset: { borderWidth: 1, height: '75%', left: '10%', opacity: 0.4, position: 'absolute', top: '15%', transform: [{ rotate: '45deg' }], width: '55%' },
});
