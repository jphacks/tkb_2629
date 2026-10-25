import { useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '../../theme/colors';
import { PageField } from '../molecules/PageField';
import { SpoilerSelector } from '../molecules/SpoilerSelector';
import { ThoughtsField } from '../molecules/ThoughtsField';

type BookmarkCardProps = {
  translateY: Animated.Value;
  onAdded: () => void;
};

export function BookmarkCard({ translateY, onAdded }: BookmarkCardProps) {
  const [page, setPage] = useState('');
  const [thoughts, setThoughts] = useState('');
  const [hasSpoiler, setHasSpoiler] = useState(true);
  const [validationError, setValidationError] = useState('');
  const isValid = /^\d+$/.test(page.trim()) && thoughts.trim().length > 0;
  const isValidRef = useRef(isValid);
  isValidRef.current = isValid;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 8 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onMoveShouldSetPanResponderCapture: (_, gestureState) =>
        Math.abs(gestureState.dy) > 8 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy < 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -120) {
          if (!isValidRef.current) {
            setValidationError('ページ数には数字、感想には文字を入力してください');
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
            return;
          }

          setValidationError('');
          Animated.timing(translateY, { duration: 280, toValue: -720, useNativeDriver: true }).start(onAdded);
          return;
        }

        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  return (
    <Animated.View {...panResponder.panHandlers} style={[styles.bookmark, { transform: [{ translateY }] }]}> 
      <View style={styles.content}>
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
        <Text style={styles.title}>「本」にしおりを追加</Text>
        <View style={styles.formFields}>
          <PageField
            onChangeText={(value) => {
              setPage(value);
              setValidationError('');
            }}
            value={page}
          />
          <ThoughtsField
            onChangeText={(value) => {
              setThoughts(value);
              setValidationError('');
            }}
            value={thoughts}
          />
          <SpoilerSelector accentColor={colors.navAccent} hasSpoiler={hasSpoiler} onChange={setHasSpoiler} tintColor="#F3EDFF" />
          <Text style={styles.swipeHint}>↑スワイプして追加↑</Text>
          {validationError && <Text style={styles.validationError}>{validationError}</Text>}
        </View>
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
    shadowColor: '#000000',
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
  title: { color: colors.text, fontSize: 24, fontWeight: '700', marginBottom: 12, marginTop: 12 },
  formFields: { gap: 20 },
  swipeHint: { color: colors.navAccent, fontSize: 24, fontWeight: '600', marginTop: 20, textAlign: 'center' },
  validationError: { color: '#B42318', fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
