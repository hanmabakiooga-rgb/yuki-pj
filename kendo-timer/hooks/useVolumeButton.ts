import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { isExpoGo } from '../constants/environment';

type VolumeListenerSub = { remove: () => void };
type VolumeManagerModule = {
  showNativeVolumeUI: (config: { enabled: boolean }) => Promise<void>;
  setVolume: (
    value: number,
    config?: { showUI?: boolean; playSound?: boolean },
  ) => Promise<void>;
  addVolumeListener: (cb: (result: { volume: number }) => void) => VolumeListenerSub;
};

/**
 * 物理音量ボタン（Up/Down どちらも）の押下を検知してコールバックを呼ぶ（PRD 3-1 / 4-2）。
 *
 * 防具着用・汗で画面タップが効きにくい状況に備えた物理ボタン操作。
 * 音量ボタン押下は「システム音量の変化イベント」として検知する。
 * 端の値(0/1)に張り付くと以降の押下で変化が起きず検知できなくなるため、
 * 押下のたびに音量を中央(0.5)へ戻す。戻し操作自体のイベントは1回だけ無視する。
 *
 * Expo Go・Web では物理音量ボタン検知を無効化する（クラッシュ回避）。
 *
 * @param onPress 押下時に呼ばれるコールバック
 * @param enabled 検知を有効にするか（既定 true）
 */
export function useVolumeButton(onPress: () => void, enabled = true): void {
  // 最新の onPress を ref 経由で参照し、購読の張り直しを避ける。
  const onPressRef = useRef(onPress);
  useEffect(() => {
    onPressRef.current = onPress;
  }, [onPress]);

  useEffect(() => {
    // Web には物理音量ボタンがなく、Expo Go ではネイティブ未対応のため購読しない。
    if (!enabled || Platform.OS === 'web' || isExpoGo) return;

    // Expo Go 以外でのみ遅延 require する（import 時クラッシュを避けるため）。
    let VolumeManager: VolumeManagerModule;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      VolumeManager = require('react-native-volume-manager').VolumeManager;
    } catch {
      // ネイティブモジュールが見つからない環境では何もしない。
      return;
    }

    // 押下時にシステム標準の音量 UI を出さない。
    void VolumeManager.showNativeVolumeUI({ enabled: false });

    // 自分で音量を戻したときのイベントを1回だけ無視するためのフラグ。
    let suppressNext = false;

    const subscription = VolumeManager.addVolumeListener(() => {
      if (suppressNext) {
        suppressNext = false;
        return;
      }
      onPressRef.current();
      suppressNext = true;
      void VolumeManager.setVolume(0.5, { showUI: false, playSound: false });
    });

    return () => subscription.remove();
  }, [enabled]);
}
