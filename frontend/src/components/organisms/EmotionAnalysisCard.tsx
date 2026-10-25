import { colors } from "../../theme/colors";
import Svg, { Defs, Line, Polygon, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { StyleSheet, Text, View } from 'react-native';

import type { EmotionComparison } from '../../lib/api';
import { GlassSurface } from '../atoms/GlassSurface';

type Emotion = {
  color: string;
  label: string;
  value: number;
};

const emotionDefinitions = [
  { label: '喜び', color: '#F9D949' },
  { label: '信頼', color: '#6BCB77' },
  { label: '恐れ', color: '#4DDBB5' },
  { label: '驚き', color: '#55A8E8' },
  { label: '悲しみ', color: '#6875D8' },
  { label: '嫌悪', color: '#9B6BD6' },
  { label: '怒り', color: '#F05D5E' },
  { label: '期待', color: '#F39A4A' },
];

const emotionNames = ['joy', 'trust', 'fear', 'surprise', 'sadness', 'disgust', 'anger', 'anticipation'];

const center = { x: 160, y: 132 };
const radius = 82;
const chartLevels = [0.25, 0.5, 0.75, 1];

export function EmotionAnalysisCard({ summary }: { summary: EmotionComparison }) {
  const mine = emotionDefinitions.map((emotion, index) => ({
    ...emotion, value: summary.mine.emotion_scores[emotionNames[index]!] ?? 0,
  }));
  const others = emotionDefinitions.map((emotion, index) => ({
    ...emotion, value: summary.others.emotion_scores[emotionNames[index]!] ?? 0,
  }));

  return (
    <GlassSurface style={styles.card}>
      <Text style={styles.heading}>感情の分析</Text>
      <View style={styles.legend}>
        <View style={styles.legendItem}><View style={[styles.mineLine, { borderColor: summary.mine.color_code }]} /><Text style={styles.legendLabel}>自分</Text></View>
        <View style={styles.legendItem}><View style={[styles.othersLine, { borderColor: summary.others.color_code }]} /><Text style={styles.legendLabel}>みんな</Text></View>
      </View>
      <Svg accessible accessibilityLabel={mine.map((emotion, index) =>
        `${emotion.label}：自分 ${summary.mine.review_count ? `${Math.round(emotion.value * 100)}%` : '未記録'}、みんな ${summary.others.review_count ? `${Math.round(others[index]!.value * 100)}%` : '未記録'}`
      ).join('\n')} height={280} viewBox="0 0 320 280" width="100%">
        <Defs>
          {emotionDefinitions.map((emotion, index) => {
            const point = getPoint(index, 1);
            return <RadialGradient key={emotion.label} id={`emotionGlow${index}`} cx={`${point.x / 320 * 100}%`} cy={`${point.y / 280 * 100}%`} r="48%">
              <Stop offset="0" stopColor={emotion.color} stopOpacity="0.22" />
              <Stop offset="1" stopColor={emotion.color} stopOpacity="0" />
            </RadialGradient>;
          })}
        </Defs>
        {emotionDefinitions.map((emotion, index) => <Rect key={emotion.label} width={320} height={280} fill={`url(#emotionGlow${index})`} />)}
        {chartLevels.map((level) => (
          <Polygon key={level} fill="none" points={createPolygonPoints(mine, level)} stroke="#CDC8DC" strokeWidth="1" />
        ))}
        {mine.map((emotion, index) => {
          const point = getPoint(index, 1);
          return <Line key={emotion.label} stroke="#E9E7F0" strokeWidth="1" x1={center.x} x2={point.x} y1={center.y} y2={point.y} />;
        })}
        {summary.others.review_count > 0 && <Polygon points={createScorePoints(others)} stroke={summary.others.color_code} strokeWidth={2} strokeDasharray="1 5" strokeLinecap="round" fill={summary.others.color_code} fillOpacity={0.08} />}
        {summary.mine.review_count > 0 && <Polygon points={createScorePoints(mine)} stroke={summary.mine.color_code} strokeWidth={2.5} fill={summary.mine.color_code} fillOpacity={0.16} />}
        {mine.map((emotion, index) => {
          const labelPoint = getPoint(index, 1.22);
          return <SvgText key={emotion.label} fill={emotion.color} fontSize="12" fontWeight="600" textAnchor="middle" x={labelPoint.x} y={labelPoint.y}>{emotion.label}</SvgText>;
        })}
      </Svg>
      {summary.mine.review_count === 0 && <Text style={styles.description}>{"しおりを書くと、自分の感情も重なります"}</Text>}
      {summary.others.review_count === 0 && <Text style={styles.description}>{"みんなの感情は、公開しおりの解析後に表示されます"}</Text>}
    </GlassSurface>
  );
}

export function getEmotionTint(color: string) {
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * 0.88).toString(16).padStart(2, '0');
  return `#${mix(red)}${mix(green)}${mix(blue)}`;
}

function getPoint(index: number, scale: number) {
  const angle = -Math.PI / 2 + (index * Math.PI) / 4;
  return {
    x: center.x + Math.cos(angle) * radius * scale,
    y: center.y + Math.sin(angle) * radius * scale,
  };
}

function createPolygonPoints(emotions: Emotion[], scale: number) {
  return emotions.map((_, index) => {
    const point = getPoint(index, scale);
    return `${point.x},${point.y}`;
  }).join(' ');
}

function createScorePoints(emotions: Emotion[]) {
  return emotions.map((emotion, index) => {
    const point = getPoint(index, emotion.value);
    return `${point.x},${point.y}`;
  }).join(' ');
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#F1ECF8', borderRadius: 16, elevation: 2, marginTop: 16, padding: 18, shadowColor: colors.black, shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { height: 1, width: 0 } },
  heading: { color: colors.text, fontSize: 16, fontWeight: '700' },
  description: { color: colors.placeholder, fontSize: 12, marginTop: 5 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, marginTop: 12 },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  mineLine: { width: 24, borderTopWidth: 3 },
  othersLine: { width: 24, borderTopWidth: 2, borderStyle: 'dotted' },
  legendLabel: { color: '#666666', fontSize: 12 },
});
