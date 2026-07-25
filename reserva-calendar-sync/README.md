# RESERVA → Googleカレンダー自動登録

RESERVA（`noreply@reserva.be`）から届く「予約が入りました」通知メールを解析し、
「予約者の氏名」「予約内容（メニュー）」「予約日時」をGoogleカレンダーの予定として自動登録するGoogle Apps Scriptです。

> ローカル環境（ブラウザでのGoogle認可が必要）で続きの作業をする場合は [`HANDOFF.md`](./HANDOFF.md) を参照してください。

## セットアップ手順

1. [script.google.com](https://script.google.com) にアクセスし、「新しいプロジェクト」を作成する。
2. デフォルトの `コード.gs` の中身を削除し、[`Code.gs`](./Code.gs) の内容を貼り付ける。
3. エディタ上部の関数選択で `syncReservaToCalendar` を選び、一度手動実行する。
   - 初回はGmail・カレンダーへのアクセス許可を求められるので承認する。
   - このとき対象メールがあれば実際に予定が登録されるので、内容を確認する。
4. 続けて関数選択で `createTrigger` を選び、一度だけ実行する。
   - `syncReservaToCalendar` を15分おきに自動実行するトリガーが登録される。
   - 実行済みのトリガーはエディタ左側の「トリガー」画面から確認・削除できる。

## 動作の仕組み

- 検索対象: `from:noreply@reserva.be subject:予約が入りました` に一致するメール
- 処理済みのメールスレッドには `RESERVA登録済み` ラベルを付与し、次回以降の重複登録を防ぐ
- 登録先はスクリプト実行アカウントのデフォルトカレンダー（`CalendarApp.getDefaultCalendar()`）
- 予定タイトルは `氏名様 - メニュー`、開始/終了時刻はメール本文の「■予約日時」欄から設定
- メール受信日より60日以上過去の日付になった場合は年またぎ予約とみなし、翌年の日付として登録

## カスタマイズ

- `Code.gs` 冒頭の `RESERVA_LABEL_NAME` / `RESERVA_SEARCH_QUERY` で検索条件・ラベル名を変更可能
- 登録先カレンダーを変更したい場合は `CalendarApp.getDefaultCalendar()` を
  `CalendarApp.getCalendarById('カレンダーID')` などに置き換える
- 実行間隔を変えたい場合は `createTrigger()` 内の `everyMinutes(15)` を変更する
  （トリガーを再登録する場合は、既存トリガーをトリガー画面から先に削除すること）
