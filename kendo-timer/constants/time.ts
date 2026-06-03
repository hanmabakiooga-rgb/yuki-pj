/**
 * 秒数を MM:SS 形式の文字列に整形する。
 * 60分以上でも MM が桁あふれして表示できるよう、分は 0 埋め最低2桁。
 */
export function formatMMSS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');
  return `${mm}:${ss}`;
}
