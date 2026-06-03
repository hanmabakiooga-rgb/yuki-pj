import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useKeepAwake } from 'expo-keep-awake';
import * as MediaLibrary from 'expo-media-library';
import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdBanner } from '../components/AdBanner';
import { BigButton } from '../components/BigButton';
import { TimerDisplay } from '../components/TimerDisplay';
import { Colors } from '../constants/colors';
import { useRecordingConfig } from '../contexts/RecordingContext';
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
 * 録画 ON の場合は CameraView を貼って自動録画開始、AlertScreen 遷移時に停止＆保存。
 * 0 秒到達で AlertScreen へ自動遷移する。
 */
export default function TimerScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { config, setConfig } = useRecordingConfig();
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

  // 録画関連
  const recordingEnabled = config.enabled;
  const cameraRef = useRef<CameraView>(null);
  const [camPerm] = useCameraPermissions();
  const [micPerm] = useMicrophonePermissions();
  const [mediaPerm, requestMediaPerm] = MediaLibrary.usePermissions();
  const isRecordingRef = useRef(false);

  useEffect(() => {
    if (!recordingEnabled) return;
    if (mediaPerm && !mediaPerm.granted && mediaPerm.canAskAgain) {
      requestMediaPerm().catch(() => {});
    }
  }, [recordingEnabled, mediaPerm, requestMediaPerm]);

  // 録画停止 → カメラロール保存。AlertScreen 遷移と画面離脱の両方からも呼ばれる。
  const stopRecordingAndSave = useCallback(async () => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    try {
      cameraRef.current?.stopRecording();
    } catch {
      // 既に停止済みなら無視。
    }
  }, []);

  // 0 秒到達 → AlertScreen へ。replace で戻る操作では計測画面に戻らない。
  const handleComplete = useCallback(() => {
    // 録画停止は recordAsync の Promise 側で保存処理が走るためここでは stop のみ。
    void stopRecordingAndSave();
    router.replace({
      pathname: '/alert',
      params: {
        screen: notifications.screen ? '1' : '0',
        flash: notifications.flash ? '1' : '0',
        beep: notifications.beep ? '1' : '0',
      },
    });
  }, [router, notifications, stopRecordingAndSave]);

  const { remainingSeconds, isRunning, start, toggle } = useTimer(
    initialSeconds,
    handleComplete,
  );

  // 画面表示と同時にカウントダウン開始。
  useEffect(() => {
    start();
    // start は安定。初回のみ実行。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // CameraView がマウントされ、権限が揃ったら録画開始。
  // recordAsync は終了時の URI を含む Promise を返すので、その then で保存する。
  const startRecordingIfReady = useCallback(async () => {
    if (!recordingEnabled) return;
    if (isRecordingRef.current) return;
    if (!cameraRef.current) return;
    if (!camPerm?.granted) return;

    isRecordingRef.current = true;
    try {
      const result = await cameraRef.current.recordAsync({
        // 上限は安全のため 1時間。
        maxDuration: 60 * 60,
      });
      isRecordingRef.current = false;
      const uri = result?.uri;
      if (!uri) return;
      // 権限があればカメラロールへ保存。
      if (mediaPerm?.granted) {
        try {
          await MediaLibrary.saveToLibraryAsync(uri);
          setConfig({ lastSavedUri: uri });
        } catch {
          // 保存失敗時は uri のみ保持。
          setConfig({ lastSavedUri: uri });
        }
      } else {
        setConfig({ lastSavedUri: uri });
      }
    } catch {
      isRecordingRef.current = false;
    }
  }, [recordingEnabled, camPerm, mediaPerm, setConfig]);

  // 権限・カメラ準備が整い次第、録画を開始する。
  useEffect(() => {
    void startRecordingIfReady();
  }, [startRecordingIfReady]);

  // 画面アンマウント時に録画が残っていれば停止。
  useEffect(() => {
    return () => {
      if (isRecordingRef.current) {
        try {
          cameraRef.current?.stopRecording();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // 音量ボタンで停止/再開トグル（PRD 3-2）。
  useVolumeButton(toggle, isFocused);

  const showRecBadge = recordingEnabled && camPerm?.granted;
  const micWarning =
    recordingEnabled && camPerm?.granted && micPerm && !micPerm.granted;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      {/* 録画用の CameraView。視覚的には小さく置き、計測画面のレイアウトを妨げない。 */}
      {recordingEnabled && camPerm?.granted ? (
        <CameraView
          ref={cameraRef}
          style={styles.previewCorner}
          facing={config.facing}
          zoom={config.zoom}
          mode="video"
        />
      ) : null}

      {showRecBadge ? (
        <View style={styles.recBadge}>
          <View style={styles.recDot} />
          <Text style={styles.recText}>REC</Text>
        </View>
      ) : null}

      <View style={styles.center}>
        <TimerDisplay
          seconds={remainingSeconds}
          color={isRunning ? Colors.text : Colors.textMuted}
        />
        {!isRunning ? <Text style={styles.pausedLabel}>一時停止中</Text> : null}
        {micWarning ? (
          <Text style={styles.warning}>マイク権限が無いため無音録画になります</Text>
        ) : null}
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

      <AdBanner placement="timer" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  previewCorner: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: 96,
    height: 128,
    borderRadius: 8,
    overflow: 'hidden',
  },
  recBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    zIndex: 10,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.alertRed,
  },
  recText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
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
  warning: {
    color: Colors.accent,
    fontSize: 12,
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
});
