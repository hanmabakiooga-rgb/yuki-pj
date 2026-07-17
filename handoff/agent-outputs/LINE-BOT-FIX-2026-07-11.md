# LINE Bot 修正指示書（2026-07-11 実機テストで確定した2バグ）

対象リポジトリ: `hanmabakiooga-rgb/line-harness-oss`（Cloudflare Workers、Worker名: `line-harness`）
実行環境: このyuki-pjセッションからはアクセス不可。**line-harness-ossにアクセスできるローカルClaude/CODEXで実行してください。**
確認方法: 実機LINEアプリでの友だち追加テスト + Cloudflareダッシュボード（Deployments/D1）

---

## §0 確認済みの事実

- Worker `line-harness` は稼働中（直近24h invocations 299件、エラー0%、D1クエリも1日中継続的に発生）
- 現在のActive Deployment（`f06ca80a`）は **24日前（6/17頃）のデプロイのまま更新されていない**
- D1バインディング `DB → line-harness`、R2バインディング `IMAGES → follow-color-images` は正常に接続済み

---

## §1 バグ1：自動応答1通目に権威性文言が入っていない

### 現在の出力（実機確認、2026-07-11）

```
FOLLOW｜気になるところだけカラーへようこそ。

ご登録ありがとうございます。

FOLLOWは、分け目・顔まわり・生え際など、
次の美容室までに気になる「ここだけ」を、
カラーリストがLINEで確認しながらケアできるサービスです。

まずは、サービス内容を4枚の画像でご確認ください。
```

### 期待される出力（`handoff/agent-outputs/B-line-reply-templates.md` §2-1、2026-06-10設計）

権威性文言（「現役カラーリスト20年、大阪のカラー専門店経営の川崎です」相当の一文）が含まれているはずだが、現在の出力には**存在しない**。

### 修正手順

1. line-harness-ossリポジトリで、上記「現在の出力」の文言（`"気になるところだけカラーへようこそ"` または `"ご登録ありがとうございます"`）をGrepし、該当するテンプレート定義箇所（`.ts`/`.js`ファイル、または別途JSON/Sheets管理の可能性あり）を特定する
2. `handoff/agent-outputs/B-line-reply-templates.md` §2-1の設計文言と現在のコードを突き合わせ、**未反映の差分**を特定する（6/10設計 → 6/17前後デプロイの間で反映漏れが起きた可能性が高い）
3. 権威性文言を追加したテンプレートに更新
4. `wrangler deploy` で再デプロイ
5. Cloudflareダッシュボード → line-harness → Deployments で新しいVersion IDが「Active」になっていることを確認
6. 実機（テスト用LINEアカウント）で友だち追加し直し、権威性文言が届くことを確認

---

## §2 バグ2：営業時間外の自動応答が動作しない

### 現在の状態（実機確認、2026-07-11）

営業時間外（19時以降）にテストメッセージを送信 → **応答なし**

### 期待される動作（`B-line-reply-templates.md` §2-12、`B-line-bot-branch-logic.md` §2、平日9:00-19:00判定）

営業時間外判定ロジックに従い、時間外自動応答テンプレが返るはず。

### 調査・修正手順

1. line-harness-ossで営業時間判定ロジック（`B-line-bot-branch-logic.md` §2記載の「JST判定・Cloudflare Workers想定」部分）が実装されているか確認する
   - 実装されていない場合 → `B-line-bot-branch-logic.md` §2の設計通りに新規実装
   - 実装されているが動いていない場合 → 以下を疑う：
     a. タイムゾーン処理のバグ（UTC/JSTのズレで営業時間判定がずれている可能性。Cloudflare WorkersはデフォルトUTCで動くため、JST変換漏れが典型的な原因）
     b. メッセージハンドラの分岐にこのロジックが接続されていない（実装はあるが呼ばれていない）
     c. 6/17デプロイ以降のコード変更でこの分岐が意図せず削除・上書きされた
2. 修正後 `wrangler deploy`
3. Cloudflareダッシュボードで新Version確認
4. 実機で19時以降にテストメッセージを送り直し、時間外応答が届くか確認

---

## §3 D1テーブル構成の確認（デプロイ修正と並行で実施）

Cloudflareダッシュボード → D1 → line-harness → **Console**タブで以下を実行し、結果を控える：

```sql
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
```

`customers`テーブルが存在するか、想定通りのカラム構成か確認する（`B-line-bot-branch-logic.md` 記載のstatusカラム等）。

もし`customers`が見当たらない場合は、テーブル名が別名（例: `users`, `subscribers`等）になっている可能性があるため、一覧から該当しそうなものを探す。

---

## §4 修正完了後の確認チェックリスト

- [ ] §1修正 → `wrangler deploy` → 新Version Active確認
- [ ] §2修正 → `wrangler deploy` → 新Version Active確認（§1と同時デプロイでよい）
- [ ] 実機テスト：友だち追加 → 権威性文言入り1通目が届く
- [ ] 実機テスト：19時以降にメッセージ送信 → 時間外応答が届く
- [ ] §3のテーブル一覧を控えてyuki-pj側に報告（GO/NOGO B-5判定に使用）

---

## 補足：D1クエリが1日中継続的に発生している件

Cloudflare D1ダッシュボードで、今日(7/11) 0:45〜21:45まで15〜30分間隔でクエリが継続発生していることを確認済み（Total queries 7k/24h）。Bot応答だけでは説明のつかない頻度のため、Cronトリガー（Overview画面で「Triggers: 1」表示）が定期的にD1へアクセスしている可能性が高い。

これが`H`エージェントの14日未返信検知の自動スキャンであれば良い兆候（GO/NOGO C-5が実は動いている可能性）。line-harness-ossの`wrangler.toml`でCronトリガーの設定内容を確認し、何を実行しているか特定することを推奨（今回のスコープ外、余裕があれば）。
