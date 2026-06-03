import * as Brightness from 'expo-brightness';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/colors';
import { useScreenBlink } from '../hooks/useScreenBlink';
import { useVolumeButton } from '../hooks/useVolumeButton';

/** params の "1"/"0" を boolean に変換 */
function parseFlag(value: string | string[] | undefined): boolean {
  return (Array.isArray(value) ? value[0] : value) === '1';
}

/**
 * AlertScreen（終了通知画面）— PRD 3-3。
 *
 * Phase 1 で実装する範囲：
 *  - スクリーン点滅（赤 ↔ 黒、0.25秒ごと / 全体 0.5秒周期）
 *  - スクリーン通知 ON のとき画面輝度を最大化
 *  - 「止め」ボタン or 音量ボタンで通知終了 → SetupScreen へ
 *
 * Phase 2 で追加予定：フラッシュ点滅・ビープ音・超過時間カウントアップ・
 * 通知最大1分での自動終了。
 */
export default function AlertScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{
    screen?: string;
    flash?: string;
    beep?: string;
  }>();

  const screenOn = parseFlag(params.screen);

  // 赤黒点滅の背景色（スクリーン通知 OFF のときは点滅しない）。
  const backgroundColor = useScreenBlink(screenOn);

  // スクリーン通知 ON のときだけ輝度を最大化し、離脱時に元へ戻す。
  useEffect(() => {
    if (!screenOn) return;
    let previous: number | null = null;
    let cancelled = false;
    (async () => {
      try {
        previous = await Brightness.getBrightnessAsync();
        if (!cancelled) {
          await Brightness.setBrightnessAsync(1);
        }
      } catch {
        // 輝度取得・設定に失敗しても通知自体は継続する。
      }
    })();
    return () => {
      cancelled = true;
      if (previous !== null) {
        Brightness.setBrightnessAsync(previous).catch(() => {});
      }
    };
  }, [screenOn]);

  // 通知終了 → 設定画面へ戻る（新しい設定画面として開き直す）。
  const stop = useCallback(() => {
    router.replace('/');
  }, [router]);

  // 音量ボタンでも即時終了（PRD 3-3）。
  useVolumeButton(stop, isFocused);

  return (
    <View style={[styles.fill, { backgroundColor }]}>
      <View style={styles.center}>
        <Text style={styles.title}>終了</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="止め"
        onPress={stop}
        style={({ pressed }) => [styles.stopButton, pressed && styles.pressed]}
      >
        <Text style={styles.stopLabel}>止め</Text>
      </Pressable>
      <Text style={styles.hint}>
        止めボタン{Platform.OS === 'web' ? '' : '・音量ボタン'}で通知を終了します
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: Colors.text,
    fontSize: 64,
    fontWeight: '900',
    letterSpacing: 4,
  },
  stopButton: {
    marginHorizontal: 24,
    minHeight: 96,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  stopLabel: {
    color: Colors.alertBlack,
    fontSize: 34,
    fontWeight: '800',
  },
  hint: {
    color: Colors.text,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 32,
  },
});
