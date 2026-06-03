import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { useEffect, useRef } from 'react';

// 静的に require して expo-audio に渡す（モジュール解決のため）。
const BEEP_SOURCE = require('../assets/beep.mp3');

/**
 * 終了通知のビープ音を一定間隔で繰り返し再生する（PRD 3-3）。
 *
 * 注：PRD は `expo-av` 指定だが、Expo SDK 56 では非バンドル化されたため
 * 代替の `expo-audio` を使用している（README に明記）。音量はプレイヤーの
 * volume を 1.0 に設定し、サイレントスイッチでも鳴るよう playsInSilentMode を ON。
 *
 * @param active ビープを有効にするか（ビープ通知 ON のときだけ true）
 * @param intervalMs ビープの再生間隔（ms）。既定 600ms。
 */
export function useBeep(active: boolean, intervalMs = 600): void {
  const player = useAudioPlayer(BEEP_SOURCE);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // サイレントスイッチでも鳴るようオーディオモードを設定。
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
    }).catch(() => {
      // ネイティブモジュール未利用環境（Web）では何もしない。
    });
  }, []);

  useEffect(() => {
    if (!active) return;
    try {
      player.volume = 1.0; // 強制最大
    } catch {
      // プレイヤー未準備時は無視（次の tick で再試行）。
    }

    const tick = () => {
      try {
        player.seekTo(0).catch(() => {});
        player.play();
      } catch {
        // 1 ティック失敗しても次回継続。
      }
    };
    tick();
    intervalRef.current = setInterval(tick, intervalMs);
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      try {
        player.pause();
      } catch {
        // 既に解放済みなら無視。
      }
    };
  }, [active, intervalMs, player]);
}
