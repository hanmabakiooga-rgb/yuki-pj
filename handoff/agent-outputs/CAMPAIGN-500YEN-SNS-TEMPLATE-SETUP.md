# 500円お試しキャンペーン — sns_templates 投入 実行手順書

作成日: 2026-07-12
対象読者: 川崎さん・運用担当（非エンジニア、GASエディタの画面操作は未経験前提）
親文書: `CAMPAIGN-500YEN-TRIAL-2026-07.md` §5（設計）、`GAS-AUTOPOST-SYSTEM-DESIGN.md`（GASコード全体）

---

## 0. 目的

`sns_templates` シートにキャンペーン文言3行を追加し、Threads自動投稿（GAS）にキャンペーン訴求を組み込む。単純追加だけだと既存21テンプレに埋もれて**キャンペーン文言が毎日出ない**設計上の問題があるため、それを検証した上で確実に毎日出す手順まで示す。

---

## 1. `sns_templates` シートの正確な列構成

`GAS-AUTOPOST-SYSTEM-DESIGN.md` の `Config.gs` 内 `setupSheets()` が実際に書き込むヘッダー行（このとおりの列名・列順が1行目に入っている前提）：

| 列 | ヘッダー名 | 型（実際にコードが読む値） | 備考 |
|---|---|---|---|
| A | `template_id` | 文字列 | 一意ID |
| B | `slot` | 文字列 | `morning` / `noon` / `night`（**小文字・完全一致で比較される**） |
| C | `theme` | 文字列 | 例: `education` / `empathy_core` / `philosophy`。**投稿の抽選条件には使われない**（後述§3） |
| D | `core_message_id` | 数値 | POSITIONING-FINAL.md §11 の1〜7 |
| E | `template_text` | 文字列（複数行可） | `{date}` `{season}` `{weekday}` `{core1}`〜`{core7}` のプレースホルダ使用可 |
| F | `active` | 文字列（`'TRUE'`/`'FALSE'`という**テキスト**として `seedTemplates()` は書き込んでいる） | 抽選対象かどうかの唯一のフラグ |
| G | `last_used_at` | 日時（新規行では空欄） | 最終使用日時。自動更新される |
| H | `use_count` | 数値（新規行では `0`） | 抽選の優先順位を決める最重要列（後述§3） |
| I | `notes` | 文字列 | 補足メモ、コードは読まない |

**重要な訂正**: `CAMPAIGN-500YEN-TRIAL-2026-07.md` §5-1の表では列G（`last_used_at`）を「(空欄)」とだけ書いているが、これは名前のない列ではなく `last_used_at` という実在の列。空欄のままでよいが、列がずれないよう注意。

### 型に関する実務上の注意

- `active` 列: 既存の `seedTemplates()` は `'TRUE'` という**文字列**を入れている。GASのコード側は `String(値).toUpperCase() === 'TRUE'` で判定しているため、セルにチェックボックス（真偽値TRUE）を入れても、テキストで `TRUE` と打っても、どちらでも動く。ただし**既存行と表記を揃えるため、テキストで大文字 `TRUE` と入力することを推奨**（`true`小文字でも大文字化されるので動くが、揺らぎを避ける）。
- `core_message_id` 列: 数値。空欄や文字列でもエラーにはならない（コード側はこの値を候補選定に使わず、そのままキュー生成時のログに残すだけ）が、既存行との整合性のため整数を入れる。
- `use_count` 列: **必ず `0`（数値）を明示的に入力する**。空欄でも `(a.row[idx.use_count] || 0)` によって0扱いされるため動作はするが、後述の抽選順位を目視確認する際に紛らわしいので明示推奨。
- `last_used_at` 列: 空欄のままでよい（既存21件の初期投入時も空欄でスタートしている）。

---

## 2. 3行の具体的な入力値（コピペ用）

`sns_templates` シートの最終行の下に、以下の3行をそのまま追加する。列はA〜Iの順。

| A: template_id | B: slot | C: theme | D: core_message_id | E: template_text | F: active | G: last_used_at | H: use_count | I: notes |
|---|---|---|---|---|---|---|---|---|
| `camp500_morn_001` | `morning` | `campaign` | `6` | （本文A、下記） | `TRUE` | （空欄） | `0` | `500円キャンペーン・朝` |
| `camp500_noon_001` | `noon` | `campaign` | `6` | （本文B、下記） | `TRUE` | （空欄） | `0` | `500円キャンペーン・昼` |
| `camp500_night_001` | `night` | `campaign` | `6` | （本文C、下記） | `TRUE` | （空欄） | `0` | `500円キャンペーン・夜` |

**本文A（E列・朝行）**:
```
おはようございます。

FOLLOWは通常月880円のセルフカラー相談サービスですが、
まずは500円でお試しいただけます。

分け目・生え際など、気になる場所だけを
LINEで相談しながら整えられます。

気になる方は、プロフィールのLINEからどうぞ。
```

**本文B（E列・昼行）**:
```
お昼です。

「気になってるけど、まだ始めてない」
そんな方への後押しとして、
まずは500円でFOLLOWをお試しいただけるようにしました。

続けるかどうかは、お試しいただいてから決めてもらえれば大丈夫です。
まずは写真を1枚、LINEで送ってみてください。
```

**本文C（E列・夜行）**:
```
お疲れさまでした。

今日、鏡を見て気になった場所はありましたか？

まずは500円でFOLLOWをお試しいただけます。
気になるところだけ、一緒に見ていきましょう。

プロフィールのLINEからどうぞ。
```

### 入力操作の注意点

- E列（本文）はセル内で改行を含む。Google Sheetsのセルに複数行テキストを入れる場合、貼り付け時に改行がそのまま複数セルに分割されてしまうことがある。**セルをダブルクリックしてから直接貼り付ける**（「値だけ貼り付け」ではなく通常貼り付けで問題ないが、貼り付け先セルを1つだけ選択した状態で行うこと）。貼り付け後、そのセルの行数が増えて見えるのが正常（1セル内の改行）。
- 既存21行の書式（フォント・背景色など）とずれないよう、直前行をコピーしてから値だけ書き換える方法でも良い。

---

## 3. 抽選ロジックの検証結果（最重要）

`ContentGenerator.gs` の `generateFromTemplate(slot, targetDate)` を実際に読んで確認した結果：

```javascript
const candidates = rows
  .map((r, i) => ({ row: r, rowIndex: i + 2 }))
  .filter(c => c.row[idx.slot] === slot && String(c.row[idx.active]).toUpperCase() === 'TRUE')
  .sort((a, b) => (a.row[idx.use_count] || 0) - (b.row[idx.use_count] || 0));
...
const chosen = candidates[0];
```

判明した事実は以下の3点：

1. **抽選条件は `slot` の完全一致と `active=TRUE` のみ**。`theme` 列は候補の絞り込みには一切使われていない（生成後のログ記録に使われるだけ）。したがって `theme: campaign` という新しい値を入れても、既存の `education`/`empathy_core`/`philosophy` としか比較しない箇所は存在せず、**抽選対象には問題なく含まれる**。ここは心配不要。

2. **ランダム抽選ではなく「使用回数が最も少ない行を機械的に選ぶ」ロジック**（乱数は使われていない）。同スロットの候補を `use_count` 昇順にソートし、先頭（最小値）を選び、選ばれた行の `use_count` を+1する。同数タイの場合はシート内の行順（早い行が先）で決まる。

3. **これにより「毎日必ずキャンペーン文言を出したい」という意図は、単純追加だけでは達成できない。** 既存テンプレは朝・昼・夜それぞれ7件ずつ（計21件）稼働済みで、システムは2026-06-20の設計以降運用されているため、既存行の `use_count` は既に一定数積み上がっている可能性が高い。新規追加したキャンペーン行は `use_count=0` からスタートするため：
   - **追加直後の1回目**は、既存行より確実に値が小さいので**最優先で選ばれる**（1回は必ず出る）。
   - しかしその1回で `use_count` が1に増えた瞬間、他の既存テンプレと横並びの土俵に戻る。以降は各スロットにつき active な候補が8件（既存7＋キャンペーン1）になるため、通常のラウンドロビンに組み込まれ、**平均して8日に1回程度しか出なくなる**（既存21テンプレに「希釈」される）。

   → **したがって、キャンペーン期間中は「毎日出る」設計にはならない。この点は必ず川崎さんに事前共有すること。**

### 確実に毎日キャンペーンを出すための対処法（推奨）

コード変更は不要。Sheets操作のみで対応できる：

**キャンペーン期間中、対象スロットの既存テンプレの `active` を一時的にすべて `FALSE` にする。**

具体的には、`sns_templates` シートで `theme` 列が `education`／`empathy_core`／`philosophy`（＝既存21行）の `active` 列（F列）を `TRUE` → `FALSE` に変更する。これにより各スロットの候補が「キャンペーン行1件のみ」になり、`use_count` の大小に関係なく**毎回そのキャンペーン行だけが選ばれる**（候補が1件しかないので抽選が成立しない＝必ず選ばれる）。

操作手順（非エンジニア向け）：
1. `sns_templates` シートを開く
2. F列（`active`）を選択し、メニュー「編集」→「検索と置換」（Ctrl+H）を開く
3. 「検索」に `TRUE`、「置換後」に `FALSE` を入力
4. 「検索対象」を「特定の範囲」にし、F2:F22（既存21行分。行番号は実際のシートで要確認、キャンペーン3行を含めないこと）を指定
5. 「すべて置換」を実行
6. 新しく追加した3行（`camp500_*`）のF列は `TRUE` のまま変更しない

**注意**: この操作を行うと、既存の教育・共感・哲学系の投稿は完全に止まり、キャンペーン文言のみが毎日3スロット投稿され続ける。ブランドの多様性は失われるが「毎日必ずキャンペーンを出す」という要求を満たすにはこれが唯一の確実な方法（コード修正なしの範囲では）。マイルドにしたい場合は、21行のうち一部（例えば各スロット3〜4件）だけを `FALSE` にして倍率を上げる、という中間案も可能（この場合も完全に毎日ではなく高確率止まりになる点に注意）。

キャンペーン終了時は、既存文書の§6の手順（キャンペーン3行を`FALSE`に戻す）に**加えて、ここで`FALSE`にした既存21行を必ず`TRUE`に戻すこと**。これを忘れると、該当スロットの active 候補がゼロになり、`generateFromTemplate()` が `No active template for slot=X` のエラーを投げて**その日の投稿が生成されなくなる**（§5参照）。

---

## 4. 入力後の確認手順

### 4-1. 手早い確認（1スロットのみ・副作用小）

1. Google Sheets「FOLLOW-KPI」を開く
2. メニュー「拡張機能」→「Apps Script」をクリック（GASエディタが別タブで開く）
3. 左側のファイル一覧から `Main.gs` を選択
4. エディタ上部、実行ボタン（▷）の左にある関数選択プルダウンで `smokeTest` を選ぶ
5. 実行ボタン（▷ 実行）をクリック
6. 初回は権限承認ダイアログが出ることがある。「許可を確認」→ Googleアカウントを選択 →「詳細」→「（プロジェクト名）に移動」→「許可」
7. 実行完了後、画面下部の「実行ログ」パネルを見る
8. `[6] Gen morning: ...(theme=campaign)` という行が出ていれば、朝スロットでキャンペーン文言が選ばれたことを確認できる（`theme=campaign` になっていない場合、§3の希釈が起きている可能性があるので、§3の対処法を適用したか確認）

※ `smokeTest()` は朝スロットのみを1回内部で呼び出す仕様（`ContentGenerator.gs` 参照）。昼・夜は次項で確認する。

### 4-2. 全スロット確認（本番キューに実データが入る点に注意）

1. GASエディタで `Main.gs` を開いたまま、関数プルダウンで `generateTomorrowPosts` を選ぶ
2. 実行ボタンをクリック
3. 実行完了後、Google Sheetsの `sns_queue` タブに戻る
4. 最終行付近に、`id` 列が `q_<明日の日付>_morning` / `q_<明日の日付>_noon` / `q_<明日の日付>_night` の3行が追加されているのを確認
5. 各行の `theme` 列と `content` 列を確認し、キャンペーン文言（本文A/B/C）が入っているか目視確認する

**重要な副作用の注意**:
- この関数は「翌日の投稿を予約する」本番機能そのものであり、実行すると `sns_queue` に実データが追加され、`use_count` も実際に加算される。テスト目的でも**1日に1回しか実行しないこと**。
- 同じ日に2回実行すると、`sns_queue` に同じ `id`（例: `q_20260713_morning`）の行が重複して追加される（既存行を上書きする仕組みではなく `appendRow` で追記されるため）。重複が発生した場合は、古い方の行を手動で削除し、最新の1行だけを残す（§5のロールバック手順も参照）。
- 通常運用では、この関数は毎日23:00に自動トリガーで実行される（`Scheduler.gs` の `installAllTriggers()` 参照）。手動実行するのは、あくまで「今日のうちに設定ミスがないか前倒しで確認したい」ときのみに留め、確認が終わったら翌日以降は自動トリガーに任せる。

---

## 5. 入力ミスがあった場合のロールバック手順

### ケースA: `sns_templates` に追加した3行の中身を直しただけで、まだ `generateTomorrowPosts()` を実行していない場合

- 該当セルを直接編集するか、行ごと削除して2章のとおり入れ直せばよい。他のタブへの影響はない（`sns_templates` はGASが**都度読み込んで参照するだけ**で、他のシートにこの行のIDを保存する仕組みはない）。

### ケースB: 誤った内容のまま `generateTomorrowPosts()`（または `smokeTestDryRunPost()`）を既に実行してしまい、`sns_queue` に誤った文言が入ってしまった場合

`sns_templates` を直しただけでは**手遅れ**。`template_text` はキュー生成時点でコピーされて `sns_queue.content` に文字列として保存される仕組みのため、テンプレ側を直しても、既にキューに入った行は自動的には更新されない。以下のいずれかを行う：

1. `sns_queue` タブを開き、該当日・該当スロットの行（`id` が `q_<日付>_<slot>`）を探す
2. その行を丸ごと削除する（投稿予定時刻前であれば削除してよい。`postScheduled()` は該当 `queueId` の行が見つからない場合、管理者LINEに `[Error] queue 未生成` の通知を出して終了するだけで、エラーにはならない）
3. `sns_templates` 側の内容を修正した後、`generateTomorrowPosts()` を再実行して正しい行を作り直す（ただし4-2の重複注意と同様、既に他のスロットの正常な行まで再生成されて重複しないよう、削除した行のスロットだけ手動で追記するか、当日中の再実行は1回のみに留める）

### ケースC: §3の対処法で既存21行の `active` を `FALSE` にしたが、キャンペーン終了時に戻し忘れた場合

- 該当スロットの active な候補が0件になり、`generateFromTemplate()` が例外 `No active template for slot=X` を投げる。`generateTomorrowPosts()` 側でこの例外は握りつぶされ（`try/catch` で `results.push({slot, status: 'error', ...})` してログに残るだけ）、その日はそのスロットの投稿がまるごと生成されない（他の2スロットは影響を受けず正常に生成される）。
- 気づいたら `sns_templates` シートで、キャンペーン開始時に `FALSE` にした既存21行の `active` 列を `TRUE` に戻す（§3の「検索と置換」操作を `FALSE`→`TRUE` に反転して実行すればよい）。
- なお `sns_log` タブの `event` 列に `failed` が3件連続で溜まると、`killSwitchHealthCheck()`（毎日6:00/18:00実行）が自動投稿全体を緊急停止（`sns_kill_switch` の `auto_post_enabled` を `FALSE`）してしまう仕組みがある。この場合は `sns_kill_switch` タブのB2セルを手動で `TRUE` に戻す必要がある（`KillSwitch.gs` 参照）。

### ケースD: `template_id` を既存行と重複させてしまった場合

- コード上、`template_id` の一意性はチェックされていない（単なる文字列列で、抽選ロジックにも使われない）。動作は壊れないが、ログや目視確認がしづらくなるため、重複が判明したら片方の `template_id` を書き換えて一意にしておく（機能への影響はない）。

---

## 6. 【確定】1週間限定運用＋自動終了トリガー（推奨・2026-07-12追記）

ユーザー判断により、キャンペーンは**1週間限定で毎日確実に流す**運用が確定した。§3で示した「既存21行のactiveをFALSEにする」対処法を採用する。

ただし、§5ケースCの通り「戻し忘れ」は該当スロットの投稿停止、最悪`killSwitchHealthCheck()`による自動投稿全体の緊急停止につながる重大リスクである。**人の記憶に頼らず、7日後に自動で元に戻る仕組み**を用意する。

### 6-1. 追加する2関数（Main.gsの末尾に貼り付け）

```javascript
/**
 * 500円キャンペーン開始：既存21テンプレを停止し、7日後に自動で戻す
 * トリガーを1件セットするだけなので、実行は1回だけでよい
 */
function startCampaign500() {
  const sheet = getSheet(CONFIG.SHEETS.TEMPLATES);
  const data = sheet.getDataRange().getValues();
  const header = data[0];
  const activeIdx = header.indexOf('active');
  const themeIdx = header.indexOf('theme');

  for (let i = 1; i < data.length; i++) {
    const theme = data[i][themeIdx];
    if (theme === 'education' || theme === 'empathy_core' || theme === 'philosophy') {
      sheet.getRange(i + 1, activeIdx + 1).setValue('FALSE');
    }
  }

  // 既存の同名トリガーが残っていれば掃除してから、7日後に1回だけ実行するトリガーを作る
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'endCampaign500') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('endCampaign500')
    .timeBased()
    .after(7 * 24 * 60 * 60 * 1000)
    .create();

  Logger.log('✅ campaign500 started: 既存21テンプレ停止、7日後に自動復帰予約済み');
  Notifier.send('[Campaign500] キャンペーン開始。既存投稿は7日間停止し、キャンペーン文言のみ流します。7日後に自動で通常投稿へ戻ります。');
}

/**
 * 500円キャンペーン終了：既存21テンプレを復帰、キャンペーン3行を停止
 * startCampaign500() が仕込んだトリガーから自動実行される（手動実行も可）
 */
function endCampaign500() {
  const sheet = getSheet(CONFIG.SHEETS.TEMPLATES);
  const data = sheet.getDataRange().getValues();
  const header = data[0];
  const activeIdx = header.indexOf('active');
  const themeIdx = header.indexOf('theme');
  const idIdx = header.indexOf('template_id');

  for (let i = 1; i < data.length; i++) {
    const theme = data[i][themeIdx];
    const id = String(data[i][idIdx] || '');
    if (theme === 'education' || theme === 'empathy_core' || theme === 'philosophy') {
      sheet.getRange(i + 1, activeIdx + 1).setValue('TRUE');
    }
    if (id.indexOf('camp500_') === 0) {
      sheet.getRange(i + 1, activeIdx + 1).setValue('FALSE');
    }
  }

  // 自分自身のトリガー（1回限りなので実行後は自動消滅するが念のため掃除）
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'endCampaign500') ScriptApp.deleteTrigger(t);
  });

  Logger.log('✅ campaign500 ended: 通常投稿に復帰、キャンペーン行は停止済み');
  Notifier.send('[Campaign500] キャンペーン終了、通常投稿に復帰しました。Square決済リンク（https://square.link/u/hOdH1kPk）の無効化も忘れずに行ってください。');
}
```

### 6-2. 実行手順

1. Main.gsに上記2関数を貼り付けて保存（Ctrl+S）
2. §2の3行を`sns_templates`に追加済みであることを確認
3. GASエディタの関数プルダウンで `startCampaign500` を選択し、実行ボタンをクリック
4. 実行ログに「✅ campaign500 started」と出れば成功。同時に管理者LINEにも開始通知が届く
5. **これで完了**。7日後、`endCampaign500` が自動的に実行され、通常投稿への復帰と管理者LINE通知（Square決済リンク無効化のリマインドつき）が自動で届く

### 6-3. 途中で手動終了したい場合

7日を待たずに終了したい場合は、GASエディタで `endCampaign500` を手動実行すればよい（トリガーも自動で片付く）。

### 6-4. この方式の利点

- 「戻し忘れ」による投稿停止・KillSwitch誤作動のリスクをゼロにする
- 開始・終了ともに管理者LINEに通知が飛ぶため、進行状況を見失わない
- 終了通知にSquare決済リンクの無効化リマインドが自動で含まれるため、`CAMPAIGN-500YEN-TRIAL-2026-07.md` §6の「決済リンク無効化」も忘れにくくなる
