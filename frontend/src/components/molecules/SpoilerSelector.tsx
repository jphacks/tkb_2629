import { StyleSheet, View } from 'react-native';

import { colors } from '../../theme/colors';
import { FieldLabel } from '../atoms/FieldLabel';
import { SegmentedTabs } from './SegmentedTabs';

type SpoilerSelectorProps = {
  accentColor?: string;
  hasSpoiler: boolean;
  onChange: (hasSpoiler: boolean) => void;
  tintColor?: string;
};

export function SpoilerSelector({ accentColor = colors.navAccent, hasSpoiler, onChange, tintColor = colors.backgroundSoft }: SpoilerSelectorProps) {
  return (
    <View style={styles.field}>
      <FieldLabel color={accentColor}>ネタバレ設定</FieldLabel>
      <SegmentedTabs
        activeColor={accentColor}
        options={[
          { label: 'ネタバレなし', value: 'no-spoiler' },
          { label: 'ネタバレあり', value: 'spoiler' },
        ]}
        value={hasSpoiler ? 'spoiler' : 'no-spoiler'}
        tintColor={tintColor}
        onChange={(value) => onChange(value === 'spoiler')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
});
