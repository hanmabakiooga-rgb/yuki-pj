import * as Brightness from 'expo-brightness';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useKeepAwake } from 'expo-keep-awake';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/colors';
import { formatMMSS } from '../constants/time';
import { useBeep } from '../hooks/useBeep';
import { useFlash } from '../hooks/useFlash';
import { useScreenBlink } from '../hooks/useScreenBlink';
import { useVolumeButton } from '../hooks/useVolumeButton';

/** params の "1"/"0" を boolean に変換 */
function parseFlag(value: string | string[] | undefined): boolean {
  return (Array.isArray(value) ? value[0] : value) === '1';
}

/** 通知継続の最大時間（PRD 3-3：1分） */
const NOTIFY_MAX_MS = 60 * 1000;
/** 超過時間カウントアップの上限（PRD 3-3：10分） */
const OVERRUN_MAX_SECONDS = 10 * 60;

/**
 * AlertScreen（終了通知画面）— PRD 3-3。
 *
 * 機能：
 *  - スクリーン点滅（赤 ↔ 黒、0.25秒ごと / 全体 0.5秒周期）
 *  - スクリーン通知 ON のとき画面輝度を最大化
 *  - カメラ LED フラッシュ点滅（50ms ごと、全体 0.1秒周期）
 *  - ビープ音（最大音量、600ms 間隔）
 *  - 超過時間カウントアップ（+MM:SS、最大 10分）
 *  - 通知は最大 1分継続後に自動停止 → SetupScreen へ
 *  - 「止め」/音量ボタンで即時終了
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
  const flashOn = parseFlag(params.flash);
  const beepOn = parseFlag(params.beep);

  // 通知（点滅・フラッシュ・ビープ）の継続状態。1分経過 or 止めで false に。
  const [notifying, setNotifying] = useState(true);
  // 超過時間（0秒到達からの経過秒数）。
  const [overrunSeconds, setOverrunSeconds] = useState(0);
  // 開始時刻（カウントアップ計算用）。
  const startedAtRef = useRef(Date.now());

  // 計測終了後もスリープ禁止を継続（PRD：カウントアップ中も継続）。
  useKeepAwake();

  // フラッシュ通知 ON のときだけカメラ権限を要求。
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  useEffect(() => {
    if (!flashOn) return;
    if (cameraPermission && !cameraPermission.granted && cameraPermission.canAskAgain) {
      requestCameraPermission().catch(() => {});
    }
  }, [flashOn, cameraPermission, requestCameraPermission]);

  // 点滅・フラッシュ・ビープのアクティブ判定（notifying と各設定の AND）。
  const blinkBg = useScreenBlink(notifying && screenOn);
  const torchOn = useFlash(notifying && flashOn && !!cameraPermission?.granted);
  useBeep(notifying && beepOn);

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

  // 1秒ごとに経過時間を更新。1分到達で通知停止、10分到達で画面に戻る。
  useEffect(() => {
    const tick = setInterval(() => {
      const elapsedMs = Date.now() - startedAtRef.current;
      const elapsedSec = Math.floor(elapsedMs / 1000);
      setOverrunSeconds(Math.min(OVERRUN_MAX_SECONDS, elapsedSec));
      if (elapsedMs >= NOTIFY_MAX_MS) {
        setNotifying(false);
      }
      if (elapsedSec >= OVERRUN_MAX_SECONDS) {
        clearInterval(tick);
        router.replace('/');
      }
    }, 250);
    return () => clearInterval(tick);
  }, [router]);

  // 通知終了 → 設定画面へ戻る（新しい設定画面として開き直す）。
  const stop = useCallback(() => {
    router.replace('/');
  }, [router]);

  // 音量ボタンでも即時終了（PRD 3-3）。
  useVolumeButton(stop, isFocused);

  // 背景色：通知中（点滅 ON）は blinkBg、それ以外は通常の暗色背景。
  const backgroundColor = notifying && screenOn ? blinkBg : Colors.background;

  return (
    <View style={[styles.fill, { backgroundColor }]}>
      {/* フラッシュ通知用の不可視カメラビュー（権限ありかつ通知中のみマウント） */}
      {flashOn && cameraPermission?.granted && notifying ? (
        <CameraView
          style={styles.hiddenCamera}
          facing="back"
          enableTorch={torchOn}
        />
      ) : null}

      <View style={styles.center}>
        <Text style={styles.title}>{notifying ? '終了' : '通知終了'}</Text>
        <Text style={styles.overrun} allowFontScaling={false}>
          +{formatMMSS(overrunSeconds)}
        </Text>
        {!notifying ? (
          <Text style={styles.subText}>通知は自動停止しました</Text>
        ) : null}
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
        止めボタン{Platform.OS === 'web' ? '' : '・音量ボタン'}で終了します
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    justifyContent: 'space-between',
  },
  hiddenCamera: {
    // 画面上に存在させつつ視覚的には見えない位置に置く（torch 制御のため）
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    color: Colors.text,
    fontSize: 64,
    fontWeight: '900',
    letterSpacing: 4,
  },
  overrun: {
    color: Colors.text,
    fontSize: 48,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  subText: {
    color: Colors.text,
    fontSize: 16,
    opacity: 0.85,
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
