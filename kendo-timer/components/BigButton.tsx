import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { Colors } from '../constants/colors';

type Variant = 'primary' | 'secondary' | 'danger';

interface BigButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  /** 通常より大きい主要アクション用ボタンにする（「始め」など） */
  hero?: boolean;
  style?: ViewStyle;
}

/**
 * 防具着用・汗の状況でも押しやすい大きめのボタン（PRD 各画面の「大ボタン」）。
 */
export function BigButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  hero = false,
  style,
}: BigButtonProps) {
  const backgroundColor =
    variant === 'primary'
      ? Colors.accent
      : variant === 'danger'
        ? Colors.alertRed
        : Colors.surface;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        hero && styles.hero,
        { backgroundColor },
        variant === 'secondary' && styles.secondaryBorder,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.label, hero && styles.heroLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 64,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    minHeight: 96,
    borderRadius: 24,
  },
  secondaryBorder: {
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  heroLabel: {
    fontSize: 34,
    fontWeight: '800',
  },
});
