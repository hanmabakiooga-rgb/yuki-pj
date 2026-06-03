import { useEffect, useState } from 'react';

/**
 * カメラ LED フラッシュ（torch）の点滅状態を返す（PRD 3-3 / 4-3）。
 *
 * 戻り値の boolean を `<CameraView enableTorch={...} />` の prop に流し込んで使う。
 * setInterval で boolean をトグルするだけのシンプルな実装。
 *
 * @param active 点滅を有効にするか（フラッシュ通知 ON のときだけ true）
 * @param halfPeriodMs 片側の表示時間（ms）。既定 50ms = 全体 0.1 秒周期。
 *   実機で 0.1 秒に追いつかない場合は 0.2 秒（halfPeriodMs=100）にフォールバック可能。
 * @returns 現在の torch ON/OFF（active=false のときは常に false）
 */
export function useFlash(active: boolean, halfPeriodMs = 50): boolean {
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!active) {
      setOn(false);
      return;
    }
    setOn(true);
    const interval = setInterval(() => {
      setOn((prev) => !prev);
    }, halfPeriodMs);
    return () => {
      clearInterval(interval);
      setOn(false);
    };
  }, [active, halfPeriodMs]);

  return on;
}
