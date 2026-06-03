/**
 * アプリ全体で使う配色定義。
 * AlertScreen の点滅は赤(#FF0000) ↔ 黒(#000000) を使用（PRD 3-3）。
 */
export const Colors = {
  alertRed: '#FF0000',
  alertBlack: '#000000',
  background: '#0E1116',
  surface: '#1B2230',
  surfaceActive: '#2A3242',
  text: '#FFFFFF',
  textMuted: '#9AA4B2',
  accent: '#E63946',
  toggleOn: '#2E7D32',
  toggleOff: '#444C5A',
  border: '#2A3242',
} as const;

export type ColorKey = keyof typeof Colors;
