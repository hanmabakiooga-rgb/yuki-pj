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

## （以降、踏んだ落とし穴があれば追記）
