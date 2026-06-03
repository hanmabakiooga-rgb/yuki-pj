import { useEffect, useRef, useState } from 'react';
import { Colors } from '../constants/colors';

/**
 * 画面全体を赤 ↔ 黒で交互点滅させるための背景色を返す（PRD 3-3 / 4-4）。
 *
 * @param active   点滅を有効にするか（スクリーン通知 ON のときだけ true）
 * @param halfPeriodMs 片側の表示時間（ms）。既定 250ms = 全体 0.5秒周期。
 * @returns 現在の背景色（active=false のときは常に黒）
 */
export function useScreenBlink(active: boolean, halfPeriodMs = 250): string {
  const [color, setColor] = useState<string>(Colors.alertRed);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) {
      setColor(Colors.alertBlack);
      return;
    }
    setColor(Colors.alertRed);
    intervalRef.current = setInterval(() => {
      setColor((prev) =>
        prev === Colors.alertRed ? Colors.alertBlack : Colors.alertRed,
      );
    }, halfPeriodMs);
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [active, halfPeriodMs]);

  return color;
}
