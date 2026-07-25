# ローカル環境への引き継ぎメモ

クラウド版Claude Codeでの作業をローカル版Claude Codeに引き継ぐためのメモです。
GASの最終デプロイはGoogleアカウントのブラウザ認可が必要なため、クラウド環境からは実行できません。ここから先はローカルで行ってください。

## 現在の状態

- リポジトリ: `hanmabakiooga-rgb/yuki-pj`
- ブランチ: `claude/reserve-google-calendar-sync-ihn6bc`
- PR: [#4](https://github.com/hanmabakiooga-rgb/yuki-pj/pull/4)（draft）
- 追加済みファイル
  - `reserva-calendar-sync/Code.gs` … 本体のGASスクリプト（Gmail解析→カレンダー登録）
  - `reserva-calendar-sync/appsscript.json` … clasp用マニフェスト（OAuthスコープ定義）
  - `reserva-calendar-sync/README.md` … 手動セットアップ手順（script.google.com経由）
- CIは未設定のリポジトリ（チェックなし）

## 残っているタスク

### 1. ブランチをローカルにpull

```
git fetch origin claude/reserve-google-calendar-sync-ihn6bc
git checkout claude/reserve-google-calendar-sync-ihn6bc
```

### 2. GASプロジェクトへのデプロイ（どちらか）

**A. 手動（ブラウザ、確実・推奨）**
`README.md` の手順どおり script.google.com でプロジェクトを作成し、`Code.gs` の中身を貼り付ける。

**B. clasp CLI（自動化したい場合）**
```
npm install -g @google/clasp
clasp login          # ブラウザでGoogleアカウントの認可が必要（要人手）
cd reserva-calendar-sync
clasp create --type standalone --title "RESERVA予約カレンダー同期" --rootDir .
clasp push
```
`clasp create` は新規に `.clasp.json` を生成し `appsscript.json` を上書きしようとするため、
既存の `appsscript.json`（OAuthスコープ定義済み）を退避 → create → 元に戻す、の順で実行すること。
`.clasp.json` はscriptID（プロジェクト固有）を含むためコミットしない。

### 3. 初回の権限承認と動作確認

- Apps Scriptエディタ（またはclasp run）で `syncReservaToCalendar` を一度手動実行し、Gmail・カレンダーへのアクセスを承認する
- 実際のRESERVA通知メールが受信箱にある状態で実行し、Googleカレンダーに正しい予定が作成されることを確認する

### 4. トリガー登録

- `createTrigger` を一度実行し、15分おきの自動実行トリガーを登録する
- 実行後、Apps Scriptエディタ左メニューの「トリガー」画面に登録されているか確認する

### 5. 動作確認後

- PR #4 の Test plan のチェックボックスを実施結果に応じて埋める
- 問題なければマージする

## 検証用サンプル（実データ、動作確認の参考）

実際に届いたRESERVA通知メールの該当部分（個人情報は伏せ済み）:

```
■予約内容
全員　頭皮ケア付き　白髪染め　リタッチ
 (90 分)

■予約者の氏名
伊藤 奈美

■予約日時
07月26日(日) 11:00～12:30
```

期待される登録結果:

| 項目 | 値 |
| --- | --- |
| タイトル | `伊藤 奈美様 - 全員　頭皮ケア付き　白髪染め　リタッチ (90 分)` |
| 開始日時 | 7/26 11:00 |
| 終了日時 | 7/26 12:30 |

## ローカルのClaude Codeにそのまま貼り付けるプロンプト例

```
hanmabakiooga-rgb/yuki-pj の claude/reserve-google-calendar-sync-ihn6bc ブランチ（PR #4）の
続きをやってほしい。reserva-calendar-sync/ 以下にRESERVA予約通知メール→Googleカレンダー
登録のGASスクリプトを用意済み。README.md と HANDOFF.md の手順に沿って、実際にGoogle Apps
Scriptプロジェクトへデプロイし、syncReservaToCalendar を実行して実在するRESERVA通知メール
から正しくカレンダー予定が作成されることを確認してほしい。うまくいったら createTrigger で
定期実行トリガーも登録して、PR #4 の Test plan を更新し、コミット・プッシュしてほしい。
```
