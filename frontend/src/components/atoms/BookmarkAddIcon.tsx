import { Image, Platform } from 'react-native';
import { SvgUri } from 'react-native-svg';

const source = require('../../assets/addBookmark.svg');

export function BookmarkAddIcon({ width, height }: { width: number; height: number }) {
  if (Platform.OS === 'web') return <Image accessible={false} source={source} style={{ width, height }} />;
  const asset = Image.resolveAssetSource(source);
  if (!asset) throw new Error('しおり追加アイコンを読み込めません');
  return <SvgUri width={width} height={height} uri={asset.uri} />;
}
