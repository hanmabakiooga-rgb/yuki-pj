import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BigButton } from '../components/BigButton';
import { TimerDisplay } from '../components/TimerDisplay';
import { Colors } from '../constants/colors';
import { useTimer } from '../hooks/useTimer';
import { useVolumeButton } from '../hooks/useVolumeButton';

/** params の "1"/"0" 文字列を boolean に変換 */
function parseFlag(value: string | string[] | undefined): boolean {
  return (Array.isArray(value) ? value[0] : value) === '1';
}

/** params の数値文字列を安全に整数化 */
function parseSeconds(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number.parseInt(raw ?? '0', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * TimerScreen（計測画面）— PRD 3-2。
 * カウントダウン表示、止め/始め、音量ボタンでの停止/再開、スリープ禁止。
 * 0 秒到達で AlertScreen へ自動遷移する。
 */
export default function TimerScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{
    seconds?: string;
    screen?: string;
    flash?: string;
    beep?: string;
  }>();

  // マウント時点のパラメータを固定（再レンダーで作り直さない）。
  const initialSeconds = useRef(parseSeconds(params.seconds)).current;
  const notifications = useRef({
    screen: parseFlag(params.screen),
    flash: parseFlag(params.flash),
    beep: parseFlag(params.beep),
  }).current;

  // スリープ禁止（計測中に画面が消えないように）。
  useKeepAwake();

  // 0 秒到達 → AlertScreen へ。replace で戻る操作では計測画面に戻らない。
  const handleComplete = useCallback(() => {
    router.replace({
      pathname: '/alert',
      params: {
        screen: notifications.screen ? '1' : '0',
        flash: notifications.flash ? '1' : '0',
        beep: notifications.beep ? '1' : '0',
      },
    });
  }, [router, notifications]);

  const { remainingSeconds, isRunning, start, toggle } = useTimer(
    initialSeconds,
    handleComplete,
  );

  // 画面表示と同時にカウントダウン開始。
  useEffect(() => {
    start();
    // start は安定（useCallback）。初回のみ実行する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 音量ボタンで停止/再開トグル（PRD 3-2）。
  useVolumeButton(toggle, isFocused);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.center}>
        <TimerDisplay
          seconds={remainingSeconds}
          color={isRunning ? Colors.text : Colors.textMuted}
        />
        {!isRunning ? <Text style={styles.pausedLabel}>一時停止中</Text> : null}
      </View>

      <View style={styles.controls}>
        <BigButton
          label={isRunning ? '止め' : '始め'}
          variant={isRunning ? 'danger' : 'primary'}
          hero
          onPress={toggle}
        />
        <Text style={styles.hint}>音量ボタンでも停止 / 再開できます</Text>
      </View>

      {/* 広告バナー（Phase 4 で AdMob 実装予定） */}
      <View style={styles.adBanner}>
        <Text style={styles.adBannerText}>広告バナー（Phase 4）</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  pausedLabel: {
    color: Colors.textMuted,
    fontSize: 18,
    fontWeight: '600',
  },
  controls: {
    paddingHorizontal: 20,
    gap: 10,
  },
  hint: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  adBanner: {
    height: 50,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  adBannerText: {
    color: Colors.textMuted,
    fontSize: 12,
  },
});
