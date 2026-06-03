import { StyleSheet, Switch, Text, View } from 'react-native';
import { Colors } from '../constants/colors';

/** 通知方法の ON/OFF 設定（PRD 3-1 通知方法） */
export interface NotificationSettings {
  /** フルスクリーン赤黒点滅 */
  screen: boolean;
  /** カメラ LED フラッシュ点滅（※効果は Phase 2 で実装） */
  flash: boolean;
  /** システムビープ音（※効果は Phase 2 で実装） */
  beep: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  screen: true,
  flash: true,
  beep: true,
};

interface NotificationTogglesProps {
  value: NotificationSettings;
  onChange: (next: NotificationSettings) => void;
}

interface Row {
  key: keyof NotificationSettings;
  label: string;
  note?: string;
}

const ROWS: Row[] = [
  { key: 'screen', label: 'スクリーン' },
  { key: 'flash', label: 'フラッシュ', note: 'Phase 2' },
  { key: 'beep', label: 'ビープ音', note: 'Phase 2' },
];

/**
 * 通知方法（スクリーン/フラッシュ/ビープ音）のトグル群。
 * Phase 1 で実機動作するのはスクリーン点滅のみ。フラッシュ・ビープは
 * 設定状態を保持しつつ、効果は Phase 2 で実装する。
 */
export function NotificationToggles({ value, onChange }: NotificationTogglesProps) {
  return (
    <View style={styles.container}>
      {ROWS.map((row) => (
        <View key={row.key} style={styles.row}>
          <View style={styles.labelWrap}>
            <Text style={styles.label}>{row.label}</Text>
            {row.note ? <Text style={styles.note}>{row.note}</Text> : null}
          </View>
          <Switch
            value={value[row.key]}
            onValueChange={(next) => onChange({ ...value, [row.key]: next })}
            trackColor={{ false: Colors.toggleOff, true: Colors.toggleOn }}
            thumbColor={Colors.text}
            accessibilityLabel={`${row.label}通知`}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  labelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  note: {
    color: Colors.textMuted,
    fontSize: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
});
