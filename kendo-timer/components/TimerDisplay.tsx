import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/colors';
import { formatMMSS } from '../constants/time';

interface TimerDisplayProps {
  /** 表示する秒数 */
  seconds: number;
  /** 先頭に付ける記号（超過時間の「+」など）。既定は空。 */
  prefix?: string;
  /** 文字色の上書き */
  color?: string;
}

/**
 * MM:SS を大きなフォントで表示する（PRD: 視認性優先）。
 * 等幅数字でカウント中のガタつきを防ぐ。
 */
export function TimerDisplay({ seconds, prefix = '', color }: TimerDisplayProps) {
  return (
    <View style={styles.container}>
      <Text
        accessibilityRole="text"
        style={[styles.text, color ? { color } : null]}
        allowFontScaling={false}
      >
        {prefix}
        {formatMMSS(seconds)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: Colors.text,
    fontSize: 96,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
});
