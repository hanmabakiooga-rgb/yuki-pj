# 剣道タイマー / KENDO Timer

少人数・仲間内の剣道稽古向けタイマー。防具（面）着用中でも気づけるよう、
**画面の赤黒点滅・カメラLEDフラッシュ・ビープ音**による多重通知を備える。

- スタック: React Native (Expo SDK 53) + TypeScript (strict)
- ナビゲーション: expo-router
- 対象: iOS（必須）/ iPad（推奨）/ Android（対応予定）

詳細仕様は別添 PRD（剣道タイマー Phase 1〜4 指示書）を参照。

## セットアップ

```bash
cd kendo-timer
npm install --legacy-peer-deps   # Expo の peer 依存回避（任意）
```

> **Expo Go の対応バージョン**: SDK 53。Android の Google Play ストアで「Expo Go」
> をインストールするか、最新版が入らない端末は
> [github.com/expo/expo/releases](https://github.com/expo/expo/releases) から
> Expo Go の APK を直接ダウンロードできる。

> Expo Go の制限：物理音量ボタン検知 / 輝度制御 / カメラ torch /
> AdMob / 録画はネイティブ機能のため、Expo Go では完全動作しません。
> **EAS Build による開発ビルド or 実機ビルドが必須**です。

### Expo Go で確認できる範囲（簡易UI動作）

```bash
npm start
# or
npx expo start
```

- SetupScreen のレイアウト / 通知トグル / 録画トグル UI
- TimerScreen のカウントダウン
- AlertScreen の赤黒点滅

### 完全動作（推奨）

EAS Build で開発ビルドを作成し、実機にインストール:

```bash
npx eas-cli login
npx eas-cli build --platform ios --profile development
# ビルド完了後、QR コードから実機にインストール
npx expo start --dev-client
```

## 実装状況（全 Phase 完了）

### Phase 1: コアタイマー

- SetupScreen / TimerScreen / AlertScreen の基本フロー
- 音量ボタンで開始・停止トグル
- スリープ禁止、バックグラウンド復帰時のタイムスタンプ補正
- AlertScreen の赤黒点滅（0.25秒/全体0.5秒周期）、輝度最大化

### Phase 2: 終了通知の完全実装

- **カメラ LED フラッシュ点滅**: `expo-camera` の `enableTorch` を 50ms ごとにトグル（全体 0.1秒周期）
  - 実機が 0.1 秒周期に追いつかない場合は `useFlash(active, 100)` を渡して 0.2 秒へフォールバック可能
- **ビープ音**: `expo-audio` の `useAudioPlayer` で `assets/beep.mp3` を 600ms 間隔で再生、`volume=1.0` 強制
  - 注：PRD は `expo-av` 指定だが、最新 API への移行を見越して `expo-audio` を使用
  - サイレントスイッチでも鳴るよう `setAudioModeAsync({ playsInSilentMode: true })`
- **超過時間カウントアップ**: `+MM:SS` 形式で最大 10 分（10:00 到達で強制終了）
- **自動終了**: 通知（点滅・フラッシュ・ビープ）は 1 分継続後に自動停止
- 「止め」/音量ボタンで即時終了 → SetupScreen へ
- カウントアップ中もスリープ禁止を継続

### Phase 3: 録画機能

- `app/camera-setup.tsx`：外/インカメ切替、ズーム（0〜1）、ライブプレビュー、「決定」で SetupScreen に戻る
- `contexts/RecordingContext.tsx`：録画設定をアプリ全体で保持
- TimerScreen 表示時に自動録画開始、`● REC` インジケーター表示
- AlertScreen 遷移 / TimerScreen アンマウントで自動停止
- `expo-media-library.saveToLibraryAsync` でカメラロールへ保存
- カメラ / マイク / 写真ライブラリの 3 権限を `app.json` で宣言

### Phase 4: 仕上げ・配布

- **AdMob バナー**: `react-native-google-mobile-ads` を SetupScreen / TimerScreen 下部に配置
  - 開発中は Google 公式テスト ID を使用（`constants/ads.ts`）
  - **本番リリース時は `PROD_BANNER_UNIT_ID` と `app.json` の `androidAppId`/`iosAppId` を実 ID に差し替え**
  - AlertScreen には配置しない（全画面点滅中）
  - Expo Go ではプレースホルダにフォールバック（クラッシュなし）
- **iPad 対応**: `useWindowDimensions` でタイマー文字（96/160/200px）とコンテンツ最大幅（540px 中央寄せ）を切替
- **プライバシーポリシー画面** (`app/privacy.tsx`)：SetupScreen からリンク
- **eas.json**：`development` / `preview` / `production` の 3 プロファイル

## TestFlight 配布手順

### 前提

- Apple Developer Program 加入（年額 99 USD）
- App Store Connect で本アプリ用のレコード作成（Bundle ID: `com.example.kendotimer` を任意の値に変更）
- AdMob でアプリ登録 → iOS / Android それぞれの App ID とバナーユニット ID を取得

### 設定の最終化

1. `app.json` の以下を実値に置換：
   - `ios.bundleIdentifier` / `android.package`
   - `react-native-google-mobile-ads.iosAppId` / `androidAppId`
2. `constants/ads.ts` の `PROD_BANNER_UNIT_ID.ios` / `.android` を実 ID に置換
3. `eas.json` の `submit.production.ios` を実 Apple ID / Team ID で更新

### ビルド〜TestFlight 配布

```bash
# 初回のみ：EAS CLI セットアップ
npm install -g eas-cli
eas login

# プロジェクトを EAS に紐付け
eas init

# TestFlight 用ビルド（internal distribution）
eas build --platform ios --profile preview

# 本番ビルド → App Store Connect へアップロード
eas build --platform ios --profile production
eas submit --platform ios --latest
```

> ビルド時に Apple ID 認証情報の入力を求められる。プロビジョニングプロファイル
> 等は EAS が自動生成・管理する（手動署名も選択可）。

## ディレクトリ構成

```
kendo-timer/
├── app/
│   ├── _layout.tsx           # ルートレイアウト（Stack + RecordingProvider）
│   ├── index.tsx             # SetupScreen
│   ├── timer.tsx             # TimerScreen（録画含む）
│   ├── alert.tsx             # AlertScreen（点滅・フラッシュ・ビープ・カウントアップ）
│   ├── camera-setup.tsx      # CameraSetupScreen
│   └── privacy.tsx           # プライバシーポリシー
├── components/
│   ├── BigButton.tsx
│   ├── TimerDisplay.tsx      # iPad レスポンシブ対応
│   ├── NotificationToggles.tsx
│   └── AdBanner.tsx          # AdMob（Expo Go ではプレースホルダ）
├── contexts/
│   └── RecordingContext.tsx
├── hooks/
│   ├── useTimer.ts           # カウントダウン + バックグラウンド補正
│   ├── useScreenBlink.ts     # 赤黒点滅
│   ├── useFlash.ts           # torch 点滅
│   ├── useBeep.ts            # ビープ音
│   └── useVolumeButton.ts    # 音量ボタン検知
├── constants/
│   ├── colors.ts
│   ├── time.ts               # MM:SS 整形
│   └── ads.ts                # AdMob ユニット ID 管理
├── assets/
│   └── beep.mp3              # 440Hz / 0.3 秒（ffmpeg で生成）
├── app.json                  # 権限・plugin 設定
└── eas.json                  # EAS Build プロファイル
```

## 画面遷移

```
SetupScreen ──[録画ON]──▶ CameraSetupScreen ──[決定]──▶ SetupScreen
     │
     [始め / 音量ボタン]
     ▼
TimerScreen ──[0秒到達]──▶ AlertScreen
     ▲                          │
     └──[止め / 音量ボタン / 1分経過自動]──┘
```

## 既知の注意点

- **Expo Go 限定**：AdMob・torch（フラッシュ）・音量ボタン・録画保存は Expo Go では無効（開発ビルドが必須）
- **expo-media-library と Expo Go**：`expo-media-library` は読み込み時に新 API 用ネイティブモジュール
  `ExpoMediaLibraryNext` を要求するが、これは Expo Go バイナリに含まれずクラッシュする。
  そのため `app/timer.tsx` では静的 import せず、**Expo Go では一切ロードしない遅延 require**
  にしている（録画自体は可能だがカメラロール保存はスキップ）。完全な保存機能は開発ビルドで動作。
- **`expo-av` → `expo-audio`**：旧 API（`expo-av`）の非推奨化に追随して新 API（`expo-audio`）を採用
- **AdMob 本番 ID**：`constants/ads.ts` と `app.json` の AdMob App ID は **必ず** 本番値へ差し替えてからストア提出すること（テスト ID で公開すると規約違反）
- **Bundle ID**：`com.example.kendotimer` はサンプル値。実際の所有ドメインに置き換える
- **音量ボタン検知の挙動**：押下時に内部で音量を 0.5 に戻す方式（端の値に張り付くと検知不能になるため）。ユーザーが意図的に音量を変更しても押下扱いになる点に留意
