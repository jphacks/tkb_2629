import { colors } from "../../theme/colors";
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '../atoms/GlassSurface';
type SegmentedTabOption = {
  label: string;
  value: string;
};

type SegmentedTabsProps = {
  activeColor?: string;
  tintColor?: string;
  onChange: (value: string) => void;
  options: SegmentedTabOption[];
  value: string;
};

export function SegmentedTabs({ activeColor = colors.accent, onChange, options, tintColor = '#FFF4F4', value }: SegmentedTabsProps) {
  return (
    <GlassSurface intensity={18} style={[styles.container, { borderColor: tintColor }]}>
      {options.map((option) => {
        const isSelected = value === option.value;

        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.tab, isSelected && styles.activeTab]}
          >
            <Text style={[styles.label, isSelected && { color: activeColor }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 10, flexDirection: 'row', padding: 3 },
  tab: { alignItems: 'center', borderRadius: 8, flex: 1, justifyContent: 'center', minHeight: 36, paddingHorizontal: 8 },
  activeTab: { backgroundColor: 'rgba(255, 255, 255, 0.58)', borderColor: 'rgba(255, 255, 255, 0.82)', borderWidth: 1, elevation: 1, shadowColor: colors.black, shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { height: 1, width: 0 } },
  label: { color: '#A1A1AA', fontSize: 12, fontWeight: '600' },
  activeLabel: { color: colors.accent },
});
