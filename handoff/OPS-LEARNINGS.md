# 運用ナレッジ：失敗と教訓の記録

最終更新: 2026-06-16
目的: 開発・運用で踏んだ落とし穴を記録、再発防止

---

## 2026-06-16｜wrangler secret put の制御文字混入

### 現象
- LINE_CHANNEL_ACCESS_TOKEN や GITHUB_REPO_OWNER などを `wrangler secret put` に貼り付けで投入したところ、
  値の途中に制御文字や改行が混入し、API呼び出しが「1文字違うトークン」「途中で切れたowner名」として送信されて失敗。
- ログにはエラーが出るが、原因が「制御文字」だと特定するのに時間がかかった。

### 原因
- ターミナル（Windows PowerShell, Git Bash, WSL いずれも）への貼り付け時に、
  クリップボードの隠れた改行・タブ・BOM などが入り込むことがある。
- `wrangler secret put` は標準入力をそのまま受け取るため、入った文字が全部 secret 値の一部になる。

### 対策（必ず守る）
1. **値はキーボードで直接入力する**（短いトークンならこれが一番安全）
2. 長いトークン（GitHub PAT 40文字等）は、
   - パスワードマネージャ経由で「表示モード」にしてから入力欄に直接入れる
   - または、`echo $TOKEN | wrangler secret put NAME` ではなく、
     `wrangler secret put NAME` で対話入力にして、手入力 or 信頼できるソースから貼り付け
3. 貼り付けた後、`wrangler secret list` で「存在」だけ確認、
   実際の動作（curl 等）で疎通テストする
4. もし疎通NGなら、まず secret を削除して再登録（中身は見えないため、上書きしないと修正できない）

### 該当した secret
- LINE_CHANNEL_ACCESS_TOKEN
- GITHUB_REPO_OWNER（owner/name）

### 学び
- "secret は見えない" ことが裏目に出る：気づかず動かない時間が発生する
- デプロイ前のスモークテスト（curl で1リクエスト送る）を必ず入れる

---

## 2026-07-11｜line-harness-oss：開発Workerと本番Workerの取り違えデプロイ

### 現象
- LINE Bot（自動応答1通目の権威性文言、営業時間外応答）を修正し `wrangler deploy` で本番反映したはずが、
  実機で確認しても**一切変化なし**。数十分ハマった。

### 原因
- `line-harness-oss` リポジトリは**同一コード・同一D1で、Worker名だけ2種類**にデプロイされる構成だった：
  - `line-harness`（開発用）
  - `follow-color`（本番用。LINE公式アカウント @884sgkre のWebhook先）
- `wrangler.toml` に `[env.production]` のような環境ブロックは無く、リポジトリ内 `HANDOFF.md` に
  「`line-harness`＝開発／`follow-color`＝本番」と明記されていたが、これを確認せずに
  デフォルト設定のまま `wrangler deploy` した結果、**開発用Workerにだけ反映**されていた。
- 本番用にデプロイするには `wrangler deploy --name follow-color` のように明示的にWorker名を指定する必要があった。

### 対策（必ず守る）
1. **line-harness-oss を触る前に必ず `HANDOFF.md`（または同等のREADME）で本番Worker名を確認する**
2. デプロイ後、`wrangler deployments list --name follow-color` で **本番Worker側**のActive Deploymentが
   更新されているか必ず確認する（開発Worker側だけ見て「デプロイできた」と誤認しない）
3. LINE公式アカウントの実際のWebhook URL（LINE Developers Console → Messaging API設定）と、
   デプロイ先Worker名が一致しているかを都度突き合わせる
4. Secretsは `--keep-vars` を付けて、本番の環境変数（LINE_CHANNEL_ACCESS_TOKEN、SQUARE決済リンク等）を
   誤って空上書きしないようにする

### 該当Worker
- 開発: `line-harness.hanma-baki-ooga.workers.dev`
- **本番: `follow-color.hanma-baki-ooga.workers.dev`（LINE公式 @884sgkre のWebhook先。これが正）**

### 学び
- 「デプロイが成功した」ログだけでは、**正しい宛先にデプロイされたか**は分からない
- 複数Worker構成のリポジトリでは、コードの正しさより先に「デプロイ先の名前」を疑う
- 実機での最終確認を省略しない（今回はこれで気づけた）

---

## （以降、踏んだ落とし穴があれば追記）
