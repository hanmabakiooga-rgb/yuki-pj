import { useIsFocused, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BigButton } from '../components/BigButton';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NotificationSettings,
  NotificationToggles,
} from '../components/NotificationToggles';
import { TimerDisplay } from '../components/TimerDisplay';
import { Colors } from '../constants/colors';
import { useVolumeButton } from '../hooks/useVolumeButton';

const MAX_SECONDS = 99 * 60 + 59; // MM:SS の表示上限（99:59）

/** 時間加算ボタンの定義 */
const ADD_BUTTONS: { label: string; seconds: number }[] = [
  { label: '+1分', seconds: 60 },
  { label: '+10秒', seconds: 10 },
  { label: '+5秒', seconds: 5 },
];

/**
 * SetupScreen（設定・スタート画面）— PRD 3-1。
 * 時間設定 / 通知トグル / 始め（タップ・音量ボタン）を担う。
 */
export default function SetupScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();

  const [seconds, setSeconds] = useState(0);
  const [notifications, setNotifications] = useState<NotificationSettings>(
    DEFAULT_NOTIFICATION_SETTINGS,
  );

  const addSeconds = useCallback((delta: number) => {
    setSeconds((current) => Math.min(MAX_SECONDS, current + delta));
  }, []);

  // リセットは設定時間のみクリア。通知設定は連動しない（PRD 3-1）。
  const reset = useCallback(() => setSeconds(0), []);

  const start = useCallback(() => {
    if (seconds <= 0) return;
    router.push({
      pathname: '/timer',
      params: {
        seconds: String(seconds),
        screen: notifications.screen ? '1' : '0',
        flash: notifications.flash ? '1' : '0',
        beep: notifications.beep ? '1' : '0',
      },
    });
  }, [router, seconds, notifications]);

  // 音量ボタン（Up/Down）でも開始。設定画面が前面のときだけ反応させる。
  useVolumeButton(start, isFocused && seconds > 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>剣道タイマー</Text>

        <TimerDisplay seconds={seconds} />

        {/* 時間加算 + リセット */}
        <View style={styles.addRow}>
          {ADD_BUTTONS.map((b) => (
            <Pressable
              key={b.label}
              accessibilityRole="button"
              accessibilityLabel={`${b.label}加算`}
              onPress={() => addSeconds(b.seconds)}
              style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
            >
              <Text style={styles.addButtonLabel}>{b.label}</Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="リセット"
            onPress={reset}
            style={({ pressed }) => [
              styles.addButton,
              styles.resetButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.addButtonLabel}>リセット</Text>
          </Pressable>
        </View>

        {/* 通知方法 */}
        <Text style={styles.sectionLabel}>通知方法</Text>
        <NotificationToggles value={notifications} onChange={setNotifications} />

        {/* 録画（Phase 3 で実装予定。レイアウト確認用に無効表示） */}
        <View style={styles.recordRow}>
          <View style={styles.recordLabelWrap}>
            <Text style={styles.recordLabel}>録画</Text>
            <Text style={styles.phaseBadge}>Phase 3</Text>
          </View>
          <Switch
            value={false}
            disabled
            trackColor={{ false: Colors.toggleOff, true: Colors.toggleOn }}
            thumbColor={Colors.textMuted}
          />
        </View>

        {/* 始め */}
        <BigButton
          label="始め"
          variant="primary"
          hero
          disabled={seconds <= 0}
          onPress={start}
          style={styles.startButton}
        />
        <Text style={styles.hint}>音量ボタン（上下どちらでも）でも開始できます</Text>
      </ScrollView>

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
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 18,
  },
  title: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  addRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  addButton: {
    flexGrow: 1,
    flexBasis: '22%',
    minHeight: 56,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButton: {
    borderColor: Colors.accent,
  },
  addButtonLabel: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: -8,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  recordLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordLabel: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  phaseBadge: {
    color: Colors.textMuted,
    fontSize: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  startButton: {
    marginTop: 4,
  },
  hint: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
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
