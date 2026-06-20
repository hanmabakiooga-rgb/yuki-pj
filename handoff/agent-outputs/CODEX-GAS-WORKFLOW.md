# CODEX 投入ガイド：GAS 自動投稿システム

作成日: 2026-06-20
位置づけ: Claude（設計）→ CODEX（実装・修正）の橋渡し
目的: トークンコストを抑え、定型的なGAS実装・微修正をCODEXに任せる

---

## 0. 全体マップ

```
[Claude] 設計（高コスト、たまに使う）
  ├ GAS-AUTOPOST-SYSTEM-DESIGN.md（コア自動投稿）
  └ GAS-DASHBOARD-ANALYTICS-EXTENSION.md（ダッシュボード・分析）
    ↓
[CODEX] 実装・修正（低コスト、毎回使う）
  ├ 初回コード貼付け補助
  ├ デバッグ
  ├ 関数追加
  ├ 表示文言の修正
  └ 新しいテンプレ追加
```

---

## 1. 初回実装：CODEX に GAS プロジェクトを構築させる

### 1-1. 前提
- GAS プロジェクト `FOLLOW Threads Autopost` を新規作成済み（ユーザー）
- FOLLOW-KPI Sheets が既存（CODEX が前に作成済み）

### 1-2. CODEX 投入プロンプト（最初に1回だけ）

```
hanmabakiooga-rgb/yuki-pj の以下2ファイルを読んで、その通りに
Google Apps Script プロジェクトを構築する手順を案内してください。

参照:
- https://raw.githubusercontent.com/hanmabakiooga-rgb/yuki-pj/claude/blissful-lovelace-jcQoP/handoff/agent-outputs/GAS-AUTOPOST-SYSTEM-DESIGN.md
- https://raw.githubusercontent.com/hanmabakiooga-rgb/yuki-pj/claude/blissful-lovelace-jcQoP/handoff/agent-outputs/GAS-DASHBOARD-ANALYTICS-EXTENSION.md

タスク:
1. 自動投稿コアの 10 .gs ファイル
2. 拡張モジュールの 6 .gs + 1 .html ファイル
3. Sheets タブ 4 + 7 = 11 タブの追加
4. Script Properties に登録すべき値の一覧
5. Time Trigger の一括設定関数の実行手順
6. Web App デプロイ手順

各 .gs/.html ファイルのコードは、設計書からそのままコピーして
私（ユーザー）にチャンク単位で渡してください。

私が GAS エディタにペーストできるよう、コピペ可能な形式で出力。
1ファイルずつ進めて、私の「次」コマンドで次のファイルに移ってください。
```

### 1-3. 期待される CODEX の動き
- 設計書を読む
- ファイル1（Config.gs）のコードを出力
- 「次」と言うまで待つ
- ユーザーが次と言ったらファイル2を出す
- 全16ファイル分繰り返し

---

## 2. よくある微修正パターン（CODEXに投げるテンプレ）

### A. 関数の挙動修正

```
GASプロジェクトの {ファイル名}.gs の {関数名} を以下のように修正してほしい：

[修正内容を自然言語で]

参照する設計書:
- https://raw.githubusercontent.com/hanmabakiooga-rgb/yuki-pj/claude/blissful-lovelace-jcQoP/handoff/agent-outputs/GAS-AUTOPOST-SYSTEM-DESIGN.md

該当関数だけ修正後の完全コードを出力してください。
```

### B. 投稿テンプレ追加

```
GAS-AUTOPOST-SYSTEM-DESIGN.md の sns_templates 初期値（21パターン）に、
以下のテンプレを追加してください：

[新規テンプレ内容]

スロット: [朝7:30 / 昼12:30 / 夜21:00 のどれか]
コア訴求: [POSITIONING §11 の7メッセージのうちどれか]

E法務チェックを通過する形（NGワードなし）で。

Main.gs の TEMPLATES_SEED に追加するコードを出力してください。
```

### C. 新しいSheetsタブ追加

```
GAS プロジェクトに新しいタブ「{タブ名}」を追加したい。
用途: [説明]
カラム: [A列=xxx, B列=yyy, ...]

以下を出力してください：
1. setupSheets() への追加コード
2. このタブを読み書きする CRUD 関数の雛形
3. Config.gs に必要な定数追加
```

### D. エラーハンドリング強化

```
GASプロジェクトの {ファイル名}.gs で、以下のエラーパターンに対応したい：

エラー内容: [貼り付け]
発生関数: [関数名]
発生状況: [どんな時に起きるか]

修正方針:
- リトライ追加
- 管理者LINE通知
- ログ詳細化

該当箇所の修正コードを出力してください。
```

### E. ダッシュボードに項目追加

```
sns_dashboard タブに以下の項目を追加したい：

項目名: [例: 「先週比成長率」]
データソース: [どのタブから引くか]
計算式: [自然言語で説明]

setupDashboard() 関数に追加するコードを出力してください。
```

### F. Time Trigger 変更

```
GAS の Time Trigger を以下のように変更したい：

現状: {現状の時刻}
変更後: {変更後の時刻}

該当関数: {関数名}

Scheduler.gs / extensionScheduler 系の修正コードを出力してください。
Trigger 削除→再作成の手順も含めて。
```

### G. AI 生成プロバイダ切り替え

```
ContentGenerator.gs の AI 生成 IF を、現状の {現状} から
{新プロバイダ} に切り替えたい。

API キー: Script Properties の {キー名} を使う
モデル: {モデル名}
エンドポイント: {URL}

該当関数だけ修正後のコード全文を出力してください。
他のファイルへの影響があれば指摘してください。
```

### H. ナレッジ DB のロジック改善

```
sns_knowledge タブのインプ閾値（現状: {現状の閾値}）を {新しい閾値} に変更したい。
また、ナレッジから次の生成プロンプトに渡す方法を {改善内容} に変更したい。

Knowledge.gs と ContentGenerator.gs の該当部分を修正してください。
```

### I. カレンダー UI の見た目調整

```
Web App のカレンダーUI（WebApp.html）の見た目を以下のように変えたい：

[修正内容: 色・フォント・余白・ボタン位置 等]

WebApp.html の該当部分のCSS or HTML を修正してください。
```

---

## 3. デバッグフロー（エラーが出た時）

### Step 1: GAS実行ログを CODEX に渡す

```
GAS の実行ログでエラーが出ました：

[GAS実行ログを貼り付け]

該当関数: {関数名}
直前に何をしたか: {操作内容}

原因と修正方法を教えてください。
修正コードがあれば該当箇所だけ出力してください。
```

### Step 2: 修正案の確認

CODEX が出した修正案をGASに貼って、再実行 → 結果を CODEX に返す。

### Step 3: 解決しなければ Claude へ

3回 CODEX で試してダメなら、このセッション（Claude）に貼って深掘り依頼。

---

## 4. 月次メンテナンス（CODEX に定期で投げる）

### 月初に毎月実行する CODEX タスク

```
yuki-pj リポジトリ最新版を確認して、以下をチェック・修正してください：

1. Threads API の仕様変更がないか公式ドキュメント確認
2. sns_templates の中で、過去30日に未使用のテンプレがないか
3. sns_knowledge の上位10件を見て、共通要素を ContentGenerator.gs にフィードバックする提案

修正提案を出してください、私が承認したら実装してください。
```

---

## 5. CODEX 投入時の節約コツ

| やる | やらない |
|---|---|
| 設計書を ref で渡す | 設計書全文を貼る |
| 該当関数だけ修正依頼 | 「全部見直して」と丸投げ |
| エラーログは必要部分だけ | 数千行のログ全部 |
| 「次」「OK」など短い返答 | 毎回詳細解説を求める |
| 1ファイル1リクエスト | 「全モジュール直して」 |

---

## 6. Claude（このセッション）に戻るべきタイミング

CODEX で対応できないケース：

- 設計判断が必要な大改修（新機能追加など）
- 7コアメッセージへの抵触判断（戦略レイヤー）
- POSITIONING-FINAL.md や SNS-STRATEGY-FINAL.md の更新を伴う変更
- 複数モジュールにまたがる大規模リファクタ
- 投稿パフォーマンスの分析→戦略再考

これら以外は CODEX で完結する想定。

---

## 7. ナレッジ：CODEX とのやり取りで学んだこと

ここに、CODEX に投げて成功・失敗したパターンを追記していく。
次回以降の投入時に参考にする。

### 成功パターン
- （随時追記）

### 失敗パターン（避けたいプロンプト）
- （随時追記）

---

## 8. リンク集

- GAS プロジェクト: （URL記入）
- FOLLOW-KPI シート: https://docs.google.com/spreadsheets/d/1Xshvq2dIJKoTLwU8E4VBR-alySOW42h96Uh7NQji4B0/edit
- Web App URL: （デプロイ後記入）
- Meta Developers Console: https://developers.facebook.com/apps/

---

## 9. 初回実装時の必須修正：投稿時刻ランダム化（Bot判定回避）

**理由：毎日同じ時刻（7:30/12:30/21:00）の投稿はThreads/Metaのアルゴリズムに「自動投稿Bot」と認識され、リーチが落ちる。**

初回実装の直後に、CODEXに以下を投げて修正してもらう：

```
GASプロジェクトの投稿時刻を、毎日±5分のランダム範囲で揺らぐように変更してください。

【現状】
- Time Trigger が固定時刻（7:30/12:30/21:00）で投稿実行

【変更後】
- 投稿実行は scheduled_at（sns_queue の予約時刻）ベース
- 翌日3投稿を生成する際、scheduled_at に以下を設定：
  - 朝: 7:30 + random(0, 300) 秒（7:30:00 〜 7:34:59）
  - 昼: 12:30 + random(0, 300) 秒
  - 夜: 21:00 + random(0, 300) 秒
- Time Trigger は 5分間隔で起動する checkAndPost() に変更
- checkAndPost() は sns_queue から scheduled_at <= now() で post_status=scheduled のレコードを取得して投稿

【修正対象ファイル】
- ContentGenerator.gs: scheduled_at にランダムオフセット加算
- Scheduler.gs: Time Trigger を「5分間隔のpolling型」に変更
- Main.gs（あるいは Scheduler.gs）: checkAndPost() 関数を新規追加

【動作確認】
- sns_queue の scheduled_at が毎日少しずつ違う秒数になっていることをログで確認
- checkAndPost() が次に投稿すべきレコードを正しく選んでいることをdryRunで確認

修正後の該当関数の完全コードを出力してください。
影響範囲も明示してください。
```

これを最初のメンテナンスタスクとして実行する。

### 補足：Trigger の再設計後の挙動

```
Cron: */5 * * * * （5分ごと）
  ↓
checkAndPost()
  ↓
sns_queue から「scheduled_at <= now() AND post_status='scheduled'」
  ↓ 該当あり
1件投稿実行
  ↓
sns_log に記録、status=posted に更新
  ↓ 該当なし
何もせず終了
```

これにより：
- 朝7:30:23、翌日 7:33:11、翌々日 7:31:47、…と毎日違う秒
- Bot判定リスク大幅低減
- 投稿漏れの可能性も低下（5分ごとのpollingが拾い直す）

---

## 10. 次のアクション

このガイドを保存したら、CODEXを開いて §1-2 のプロンプトを投げる。  
GASプロジェクトに16ファイル分のコードが順次貼り付けられる。  
**全コード貼り付け完了後、§9 の「時刻ランダム化」を最初のメンテナンスタスクとして実行**。  
途中で詰まったら §3 のデバッグフローへ。
