import { useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import { PageField } from '../molecules/PageField';
import { SpoilerSelector } from '../molecules/SpoilerSelector';
import { ThoughtsField } from '../molecules/ThoughtsField';

type BookmarkCardProps = {
  bookTitle?: string;
  iterationNumber?: number;
  maxPage?: number;
  translateY: Animated.Value;
  onAdd?: (page: number, thoughts: string) => Promise<void>;
  onAdded: (page: number) => void;
};

export function BookmarkCard({
  bookTitle = '本',
  iterationNumber,
  maxPage,
  translateY,
  onAdd,
  onAdded,
}: BookmarkCardProps) {
  const [page, setPage] = useState('');
  const [thoughts, setThoughts] = useState('');
  const [hasSpoiler, setHasSpoiler] = useState(true);
  const [validationError, setValidationError] = useState('');
  const pageNumber = Number(page);
  const isValid = /^\d+$/.test(page.trim())
    && pageNumber >= 1
    && (maxPage === undefined || pageNumber <= maxPage)
    && thoughts.trim().length > 0;
  const isValidRef = useRef(isValid);
  const pageRef = useRef(pageNumber);
  const thoughtsRef = useRef(thoughts);
  const onAddRef = useRef(onAdd);
  const onAddedRef = useRef(onAdded);
  const submittingRef = useRef(false);
  isValidRef.current = isValid;
  pageRef.current = pageNumber;
  thoughtsRef.current = thoughts;
  onAddRef.current = onAdd;
  onAddedRef.current = onAdded;

  const submitBookmark = async () => {
    if (!isValidRef.current) {
      setValidationError(
        maxPage === undefined
          ? 'ページ数には数字、感想には文字を入力してください'
          : `1〜${maxPage}ページと感想を入力してください`,
      );
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      return;
    }
    if (submittingRef.current) {
      return;
    }
    submittingRef.current = true;
    setValidationError('');
    try {
      await onAddRef.current?.(pageRef.current, thoughtsRef.current.trim());
      Animated.timing(
        translateY,
        { duration: 280, toValue: -720, useNativeDriver: true },
      ).start(() => onAddedRef.current(pageRef.current));
    } catch (reason) {
      setValidationError(reason instanceof Error ? reason.message : 'しおりを追加できませんでした');
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
    } finally {
      submittingRef.current = false;
    }
  };

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
          void submitBookmark();
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
        <Text style={styles.title}>「{bookTitle}」にしおりを追加</Text>
        {iterationNumber !== undefined && (
          <Text style={styles.iteration}>{iterationNumber}回目の読書</Text>
        )}
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
          <SpoilerSelector hasSpoiler={hasSpoiler} onChange={setHasSpoiler} />
          <Text style={styles.swipeHint}>↑スワイプして追加↑</Text>
          {validationError && <Text style={styles.validationError}>{validationError}</Text>}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bookmark: {
    backgroundColor: colors.bookmarkTop,
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
    backgroundColor: colors.bookmarkBottom,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '700', marginBottom: 12, marginTop: 12 },
  iteration: { color: colors.placeholder, fontSize: 14, fontWeight: '600', marginBottom: 12 },
  formFields: { gap: 20 },
  swipeHint: { color: colors.background, fontSize: 24, fontWeight: '600', marginTop: 20, textAlign: 'center' },
  validationError: { color: '#B42318', fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
