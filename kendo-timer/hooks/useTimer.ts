import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

/**
 * カウントダウンタイマー。
 *
 * 残り時間は「終了予定タイムスタンプ - 現在時刻」から都度計算する方式のため、
 * バックグラウンド移行中に setInterval が止まっても、復帰時に正しい残り時間へ
 * 補正される（PRD 4-5 のタイムスタンプ差分補正をこの方式で内包）。
 */
export interface UseTimerResult {
  /** 残り秒数（0 以上の整数） */
  remainingSeconds: number;
  /** カウントダウン進行中かどうか */
  isRunning: boolean;
  /** カウントダウン開始（停止中からの再開も含む） */
  start: () => void;
  /** 一時停止 */
  pause: () => void;
  /** 進行中なら停止、停止中なら再開するトグル */
  toggle: () => void;
}

const TICK_MS = 200;

export function useTimer(
  initialSeconds: number,
  onComplete?: () => void,
): UseTimerResult {
  const [remainingSeconds, setRemainingSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(false);

  // 状態のソース・オブ・トゥルースは ref 側に持ち、state は表示用ミラー。
  const remainingRef = useRef(initialSeconds); // 停止中の残り秒数
  const endTimestampRef = useRef<number | null>(null); // 進行中の終了予定時刻(ms)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // onComplete を ref 経由で参照し、依存配列での再生成を避ける。
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const clearTick = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // 残り秒数を ref と state の両方へ反映する。
  const applyRemaining = useCallback((value: number) => {
    remainingRef.current = value;
    setRemainingSeconds(value);
  }, []);

  // 終了予定時刻から残り時間を計算して反映。0 到達で完了処理。
  const sync = useCallback(() => {
    if (endTimestampRef.current === null) return;
    const remainingMs = endTimestampRef.current - Date.now();
    const remaining = Math.max(0, Math.round(remainingMs / 1000));
    applyRemaining(remaining);
    if (remainingMs <= 0) {
      endTimestampRef.current = null;
      clearTick();
      setIsRunning(false);
      onCompleteRef.current?.();
    }
  }, [applyRemaining, clearTick]);

  const start = useCallback(() => {
    // 停止中かつ残り 0 なら開始しない。
    if (endTimestampRef.current === null && remainingRef.current <= 0) return;
    // 停止中からの開始時のみ終了予定時刻を引き直す（進行中なら維持）。
    if (endTimestampRef.current === null) {
      endTimestampRef.current = Date.now() + remainingRef.current * 1000;
    }
    setIsRunning(true);
    // インターバルを貼り直す（二重生成や、StrictMode 再マウントでの欠落を防ぐ）。
    clearTick();
    intervalRef.current = setInterval(sync, TICK_MS);
  }, [clearTick, sync]);

  const pause = useCallback(() => {
    if (endTimestampRef.current === null) return; // すでに停止中
    // 現在の残り時間を確定させてから停止する。
    const remaining = Math.max(
      0,
      Math.round((endTimestampRef.current - Date.now()) / 1000),
    );
    endTimestampRef.current = null;
    clearTick();
    applyRemaining(remaining);
    setIsRunning(false);
  }, [applyRemaining, clearTick]);

  const toggle = useCallback(() => {
    if (endTimestampRef.current !== null) {
      pause();
    } else {
      start();
    }
  }, [pause, start]);

  // バックグラウンド → フォアグラウンド復帰時に残り時間を補正する。
  useEffect(() => {
    const handleAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') {
        sync();
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [sync]);

  // アンマウント時にインターバルを必ず解除する。
  useEffect(() => clearTick, [clearTick]);

  return { remainingSeconds, isRunning, start, pause, toggle };
}
