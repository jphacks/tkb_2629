import { StyleSheet, View } from 'react-native';

import { FieldLabel } from '../atoms/FieldLabel';
import { SegmentedTabs } from './SegmentedTabs';

type SpoilerSelectorProps = {
  hasSpoiler: boolean;
  onChange: (hasSpoiler: boolean) => void;
};

export function SpoilerSelector({ hasSpoiler, onChange }: SpoilerSelectorProps) {
  return (
    <View style={styles.field}>
      <FieldLabel>ネタバレ設定</FieldLabel>
      <SegmentedTabs
        options={[
          { label: 'ネタバレなし', value: 'no-spoiler' },
          { label: 'ネタバレあり', value: 'spoiler' },
        ]}
        value={hasSpoiler ? 'spoiler' : 'no-spoiler'}
        onChange={(value) => onChange(value === 'spoiler')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
});
