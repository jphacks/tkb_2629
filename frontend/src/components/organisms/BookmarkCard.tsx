import { useRef } from 'react';
import { Animated, PanResponder, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '../../theme/colors';
import { PageField } from '../molecules/PageField';
import { ActionButton } from '../molecules/ActionButton';
import { ThoughtsField } from '../molecules/ThoughtsField';

type BookmarkCardProps = {
  translateY: Animated.Value;
  title: string;
  page: string;
  thoughts: string;
  loaded: boolean;
  updating: boolean;
  busy: boolean;
  readOnly?: boolean;
  error: string | null;
  color?: string;
  analysisLabel?: string;
  onPageChange: (value: string) => void;
  onThoughtsChange: (value: string) => void;
  onRetry: () => void;
  onSubmit: () => void;
};

export function BookmarkCard(props: BookmarkCardProps) {
  const {
    translateY, title, page, thoughts, loaded, updating, busy, error, color, readOnly = false,
    onPageChange, onThoughtsChange, onRetry, analysisLabel,
  } = props;
  const latest = useRef(props);
  latest.current = props;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        latest.current.loaded && !latest.current.busy && !latest.current.readOnly &&
        gestureState.dy < -8 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onMoveShouldSetPanResponderCapture: (_, gestureState) =>
        latest.current.loaded && !latest.current.busy && !latest.current.readOnly &&
        gestureState.dy < -8 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gestureState) => {
        if (!latest.current.busy && !latest.current.readOnly && gestureState.dy < 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (latest.current.busy || latest.current.readOnly) {
          return;
        }
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        if (gestureState.dy < -80 && latest.current.loaded) {
          latest.current.onSubmit();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  return (
    <Animated.View {...panResponder.panHandlers} style={[styles.bookmark, { transform: [{ translateY }] }]}>
      <View style={[styles.content, color ? styles.savedContent : undefined]}>
        {color && <View pointerEvents="none" style={[styles.colorTint, { backgroundColor: color }]} />}
        {!color && (
          <Svg pointerEvents="none" preserveAspectRatio="none" style={styles.mesh} viewBox="0 0 100 100">
            <Defs>
              <RadialGradient cx="8%" cy="62%" id="bookmarkMeshYellow" r="50%">
                <Stop offset="0%" stopColor="#E8F58E" stopOpacity="0.95" />
                <Stop offset="100%" stopColor="#E8F58E" stopOpacity="0" />
              </RadialGradient>
              <RadialGradient cx="80%" cy="20%" id="bookmarkMeshPink" r="50%">
                <Stop offset="0%" stopColor="#F5A6C8" stopOpacity="0.95" />
                <Stop offset="100%" stopColor="#F5A6C8" stopOpacity="0" />
              </RadialGradient>
              <RadialGradient cx="40%" cy="80%" id="bookmarkMeshBlue" r="50%">
                <Stop offset="0%" stopColor="#8FD9F8" stopOpacity="0.95" />
                <Stop offset="100%" stopColor="#8FD9F8" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect fill="#C8D6FF" height="100" width="100" />
            <Rect fill="url(#bookmarkMeshYellow)" height="100" width="100" />
            <Rect fill="url(#bookmarkMeshPink)" height="100" width="100" />
            <Rect fill="url(#bookmarkMeshBlue)" height="100" width="100" />
          </Svg>
        )}
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>「{title}」のしおり{readOnly ? 'を読む' : updating ? 'を更新' : 'を追加'}</Text>
          <View style={styles.formFields}>
            <PageField
              onChangeText={onPageChange}
              editable={!busy}
              value={page}
            />
            {!loaded && !error && <Text style={styles.note}>{page.trim() ? 'ページの感想を確認しています。' : 'ページを入力すると、保存済みの感想を自動で読み込みます。'}</Text>}
            <ThoughtsField onChangeText={onThoughtsChange} editable={loaded && !busy && !readOnly} value={thoughts} />
            {loaded && readOnly && !updating && <Text style={styles.note}>このページにはしおりがありません。</Text>}
            {color && <View style={[styles.savedColor, { backgroundColor: color }]} />}
            {analysisLabel && <Text style={styles.note}>{analysisLabel}</Text>}
            {loaded && !readOnly && (
              <>
                <Text style={styles.note}>{Array.from(thoughts.trim()).length} / 140文字</Text>
                <Text style={styles.note}>ネタバレ設定・他の人への公開は未対応です。</Text>
                <Text style={styles.swipeHint}>{busy ? '保存しています…' : `↑スワイプして${updating ? '更新' : '追加'}↑`}</Text>
                <ActionButton label={busy ? '保存中…' : updating ? 'しおりを更新する' : 'しおりを追加する'} onPress={busy ? undefined : props.onSubmit} />
              </>
            )}
            {error && <Text accessibilityRole="alert" style={styles.validationError}>{error}</Text>}
            {error && !loaded && <ActionButton label="読み込みを再試行" onPress={onRetry} />}
          </View>
        </ScrollView>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bookmark: {
    backgroundColor: '#C8D6FF',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    bottom: 0,
    left: 21,
    position: 'absolute',
    right: 21,
    shadowColor: colors.black,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    top: 104,
  },
  content: {
    backgroundColor: '#C8D6FF',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    flex: 1,
    overflow: 'hidden',
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  mesh: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  savedContent: { backgroundColor: '#FFFFFF' },
  colorTint: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0, opacity: 0.2 },
  scrollContent: { paddingBottom: 120 },
  note: { color: colors.text, fontSize: 13 },
  savedColor: { height: 18, borderRadius: 4 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700', marginBottom: 12, marginTop: 12 },
  formFields: { gap: 20 },
  swipeHint: { color: colors.navAccent, fontSize: 24, fontWeight: '600', marginTop: 20, textAlign: 'center' },
  validationError: { color: '#B42318', fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
