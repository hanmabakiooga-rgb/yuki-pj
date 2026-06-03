# 剣道タイマー / KENDO Timer

少人数・仲間内の剣道稽古向けタイマー。防具（面）着用中でも気づけるよう、
**画面の赤黒点滅による視覚通知**を中心に据えたアプリ。

- スタック: React Native (Expo SDK 56) + TypeScript (strict)
- ナビゲーション: expo-router
- 対象: iOS（必須）/ iPad（推奨）/ Android（対応予定）

詳細仕様は `../810a2bed-KENDO_Timer_PRD.md`（PRD）を参照。

## セットアップ

```bash
cd kendo-timer
npm install
npm run ios      # iOS シミュレータ / 実機（Mac 必要）
npm run android  # Android
npm start        # Expo Dev Server（Expo Go / Dev Client）
```

> 物理音量ボタン検知（`react-native-volume-manager`）と輝度制御
> （`expo-brightness`）はネイティブ機能のため、実機または開発ビルドでの
> 動作確認を推奨。Expo Go / Web では一部が無効化される。

## 実装状況

### Phase 1（実装済み）— コアタイマー

- **SetupScreen**（`app/index.tsx`）
  - `MM:SS` 表示（初期値 `00:00`）
  - `+1分` / `+10秒` / `+5秒` 加算、`リセット`
  - 通知トグル（スクリーン / フラッシュ / ビープ音）※効果はスクリーンのみ Phase 1
  - `始め` ボタン、**音量ボタン**でも開始
- **TimerScreen**（`app/timer.tsx`）
  - カウントダウン表示、`止め` / `始め` トグル
  - **音量ボタン**で停止 / 再開
  - スリープ禁止（`expo-keep-awake`）
  - バックグラウンド復帰時のタイムスタンプ補正
  - 0 秒到達で AlertScreen へ自動遷移
- **AlertScreen**（`app/alert.tsx`）
  - 画面全体を赤(`#FF0000`)↔黒(`#000000`)で 0.25 秒ごとに点滅（全体 0.5 秒周期）
  - スクリーン通知 ON のとき輝度を最大化（`expo-brightness`）
  - `止め` ボタン / 音量ボタンで通知終了 → SetupScreen へ

### 未実装（PRD の後続フェーズ）

- Phase 2: カメラフラッシュ点滅、ビープ音、超過時間カウントアップ、通知最大1分の自動終了
- Phase 3: 録画（`expo-camera`）、CameraSetupScreen、カメラロール保存
- Phase 4: AdMob バナー、iPad レイアウト最適化、ストア申請メタデータ、プライバシーポリシー

## ディレクトリ構成

```
kendo-timer/
├── app/
│   ├── _layout.tsx        # ルートレイアウト（Stack）
│   ├── index.tsx          # SetupScreen
│   ├── timer.tsx          # TimerScreen
│   └── alert.tsx          # AlertScreen
├── components/
│   ├── BigButton.tsx
│   ├── TimerDisplay.tsx
│   └── NotificationToggles.tsx
├── hooks/
│   ├── useTimer.ts        # カウントダウン（バックグラウンド補正込み）
│   ├── useScreenBlink.ts  # 赤黒点滅
│   └── useVolumeButton.ts # 音量ボタン検知
└── constants/
    ├── colors.ts
    └── time.ts            # MM:SS 整形
```

## 画面遷移

```
SetupScreen ──[始め / 音量ボタン]──▶ TimerScreen ──[0秒到達]──▶ AlertScreen
     ▲                                                              │
     └──────────────────[止め / 音量ボタン]─────────────────────────┘
```
