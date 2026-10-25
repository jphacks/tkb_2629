import { useRef } from 'react';
import { Animated, PanResponder, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import type { PanResponderCallbacks } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '../../theme/colors';
import type { ReviewVisibility } from '../../lib/api';
import { PageField } from '../molecules/PageField';
import { ActionButton } from '../molecules/ActionButton';
import { ThoughtsField } from '../molecules/ThoughtsField';
import { FieldLabel } from '../atoms/FieldLabel';

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
  visibility: ReviewVisibility;
  onVisibilityChange: (value: ReviewVisibility) => void;
  containsSpoilers: boolean;
  onSpoilersChange: (value: boolean) => void;
};

const SWIPE_START_DISTANCE = 24;
const SWIPE_SAVE_DISTANCE = 104;

export function BookmarkCard(props: BookmarkCardProps) {
  const {
    translateY, title, page, thoughts, loaded, updating, busy, error, color, readOnly = false,
    onPageChange, onThoughtsChange, onRetry, analysisLabel,
  } = props;
  const latest = useRef(props);
  latest.current = props;
  const scroll = useRef({ offset: 0, viewport: 0, content: 0 });
  const bottomSwipe = useRef(false);
  const touch = useRef({ x: 0, y: 0, dy: 0 });
  function finishSwipe(dy: number) {
    if (!latest.current.loaded || latest.current.busy || latest.current.readOnly) return;
    const reached = dy <= -SWIPE_SAVE_DISTANCE;
    const length = Array.from(latest.current.thoughts.trim()).length;
    if (!reached || length < 1 || length > 140) {
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
    }
    if (reached) latest.current.onSubmit();
  }
  const gestures: PanResponderCallbacks = {
      onMoveShouldSetPanResponder: (_, gestureState) =>
        latest.current.loaded && !latest.current.busy && !latest.current.readOnly &&
        gestureState.dy < -SWIPE_START_DISTANCE && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.5,
      onMoveShouldSetPanResponderCapture: (_, gestureState) =>
        latest.current.loaded && !latest.current.busy && !latest.current.readOnly &&
        gestureState.dy < -SWIPE_START_DISTANCE && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        bottomSwipe.current = false;
        translateY.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        if (!latest.current.busy && !latest.current.readOnly && gestureState.dy < 0) {
          translateY.setValue(Math.min(0, gestureState.dy + SWIPE_START_DISTANCE));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        finishSwipe(gestureState.dy);
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      },
  };
  const panResponder = useRef(PanResponder.create(gestures)).current;

  return (
    <>
      {!readOnly && (
        <View
          {...panResponder.panHandlers}
          accessibilityLabel="しおりのスワイプ領域"
          style={styles.swipeArea}
        />
      )}
    <Animated.View
      onTouchStartCapture={(event) => {
        const { offset, viewport, content } = scroll.current;
        // Scrolling to the bottom must finish before a new gesture can save.
        bottomSwipe.current = latest.current.loaded && !latest.current.busy && !latest.current.readOnly &&
          viewport > 0 && content > 0 && offset + viewport >= content - 2;
        touch.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY, dy: 0 };
      }}
      onTouchMoveCapture={(event) => {
        if (!bottomSwipe.current || latest.current.busy || latest.current.readOnly) return;
        const dx = event.nativeEvent.pageX - touch.current.x;
        const dy = event.nativeEvent.pageY - touch.current.y;
        if (dy < -SWIPE_START_DISTANCE && Math.abs(dy) > Math.abs(dx) * 1.5) {
          touch.current.dy = dy;
          translateY.setValue(dy + SWIPE_START_DISTANCE);
        } else if (touch.current.dy !== 0) {
          touch.current.dy = 0;
          translateY.setValue(0);
        }
      }}
      onTouchEndCapture={() => {
        if (!bottomSwipe.current) return;
        bottomSwipe.current = false;
        if (touch.current.dy < 0) finishSwipe(touch.current.dy);
      }}
      onTouchCancelCapture={() => {
        bottomSwipe.current = false;
        if (touch.current.dy < 0 && !latest.current.busy) {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        }
      }}
      style={[styles.bookmark, { transform: [{ translateY }] }]}
    >
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
        <ScrollView
          style={styles.scroll}
          scrollEnabled={!busy}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          scrollEventThrottle={16}
          bounces={false}
          overScrollMode="never"
          onLayout={(event) => { scroll.current.viewport = event.nativeEvent.layout.height; }}
          onContentSizeChange={(_, height) => { scroll.current.content = height; }}
          onScroll={(event) => {
            const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
            scroll.current = { offset: contentOffset.y, viewport: layoutMeasurement.height, content: contentSize.height };
          }}
        >
          <View style={styles.dragHeading}>
            <Text style={styles.title}>「{title}」{readOnly ? 'のしおりを読む' : updating ? 'のしおりを更新' : 'にしおりを追加'}</Text>
          </View>
          <View style={styles.formFields}>
            <PageField
              onChangeText={onPageChange}
              editable={!busy}
              value={page}
            />
            {!loaded && !error && <Text style={styles.note}>{page.trim() ? 'ページの感想を確認しています。' : 'ページを入力すると、保存済みの感想を自動で読み込みます。'}</Text>}
            <ThoughtsField onChangeText={onThoughtsChange} editable={loaded && !busy && !readOnly} value={thoughts} />
            {loaded && (!readOnly || updating) && (
              <View style={styles.visibilityRow} onTouchStart={() => { bottomSwipe.current = false; }}>
                <FieldLabel>他の読者に公開する</FieldLabel>
                <Switch
                  style={styles.visibilitySwitch}
                  accessibilityLabel="他の読者に公開する"
                  value={props.visibility === 'public'}
                  disabled={busy || readOnly}
                  onValueChange={(value) => props.onVisibilityChange(value ? 'public' : 'private')}
                />
              </View>
            )}
            {loaded && (!readOnly || updating) && (
              <View style={styles.visibilityRow} onTouchStart={() => { bottomSwipe.current = false; }}>
                <FieldLabel>ネタバレを含む</FieldLabel>
                <Switch
                  style={styles.visibilitySwitch}
                  accessibilityLabel="ネタバレを含む"
                  value={props.containsSpoilers}
                  disabled={busy || readOnly}
                  onValueChange={props.onSpoilersChange}
                />
              </View>
            )}
            {loaded && readOnly && !updating && <Text style={styles.note}>このページにはしおりがありません。</Text>}
            {analysisLabel && <Text style={styles.note}>{analysisLabel}</Text>}
            {loaded && !readOnly && (
              <>
                <Text style={styles.note}>公開への同意を保存します。他の読者への表示は準備中です。</Text>
                <ActionButton label={busy ? '保存中…' : updating ? 'しおりを更新する' : 'しおりを追加する'} onPress={busy ? undefined : props.onSubmit} />
              </>
            )}
            {error && <Text accessibilityRole="alert" style={styles.validationError}>{error}</Text>}
            {error && !loaded && <ActionButton label="読み込みを再試行" onPress={onRetry} />}
          </View>
        </ScrollView>
        {loaded && !readOnly && (
          <View
            {...panResponder.panHandlers}
            accessibilityLabel="しおりの下端スワイプ領域"
            style={styles.bottomSwipeArea}
          >
            <Text style={styles.swipeHint}>{busy ? '保存しています…' : `↑スワイプして${updating ? '更新' : '追加'}↑`}</Text>
          </View>
        )}
      </View>
    </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  swipeArea: { position: 'absolute', top: 0, left: 0, right: 0, height: 104, zIndex: 3 },
  dragHeading: { minHeight: 64, justifyContent: 'center' },
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
  scrollContent: { paddingBottom: 32 },
  note: { color: colors.text, fontSize: 13 },
  visibilityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, gap: 12 },
  visibilitySwitch: { transform: [{ scale: 1.2 }], marginHorizontal: 6 },
  scroll: { flex: 1 },
  bottomSwipeArea: { minHeight: 72, justifyContent: 'center', paddingVertical: 12 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700', marginBottom: 12, marginTop: 12 },
  formFields: { gap: 20 },
  swipeHint: { color: colors.navAccent, fontSize: 24, fontWeight: '600', textAlign: 'center' },
  validationError: { color: '#B42318', fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
