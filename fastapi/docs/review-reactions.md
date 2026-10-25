# 公開感想のリアクション

バックエンドのみの実装です。[公開感想一覧](public-reviews.md) に載る感想に対して、
ログイン済みの読者がリアクションできます。通知・DM・押した人の一覧は提供しません。
フロントは別ブランチで対応します。アイコンはハート・電球・目を使う想定です。

## 種類と操作

| APIの値 | 表示名 | アイコン案 |
| --- | --- | --- |
| `empathy` | 共感した | ハート |
| `insight` | なるほど | 電球 |
| `curious` | 気になる | 目 |

1人につき同じ感想に1種類までです。別の種類を選ぶと置き換わります。
自分の感想にも付けられます。押す側の公開用表示名や本棚への追加は不要です。
同じ表示名から本人判定は行わず、認証されたユーザーだけを操作対象にします。

APIはトグルではなく冪等なPUT・DELETEです。
フロントでは選択中のボタンを再度押すとDELETE、別の種類ならPUTを送ってください。
レスポンス成功後に状態を更新し、送信中は操作を無効にします。
失敗時は成功表示にせず再試行できるようにしてください。
本文を隠している感想は、本文を開いてからリアクション操作を表示する想定です。
ネタバレ設定自体は公開本文やリアクションへのアクセス制限ではありません。

## API

すべてBearer認証必須です。`google_books_id` は空白を含まない1〜256文字、
`review_id` は1以上の感想IDです。本棚の数値IDではありません。

```http
GET /catalog/books/{google_books_id}/reviews/{review_id}/reactions
PUT /catalog/books/{google_books_id}/reviews/{review_id}/reaction
DELETE /catalog/books/{google_books_id}/reviews/{review_id}/reaction
```

PUTの本文:

```json
{"kind": "empathy"}
```

PUTは種類を指定して追加・置き換え、DELETEは自分の分だけを取り消します。
既に同じ種類を選択済みのPUT、既に取り消し済みのDELETEも成功します。
`kind` の省略・null・不正な値と追加フィールドは422です。
DELETEとGETには本文を付けません。

3つのAPIはすべて200で同じ形式を返します。

```json
{
  "review_id": 12,
  "counts": {
    "empathy": 3,
    "insight": 2,
    "curious": 1
  },
  "my_reaction": "empathy"
}
```

選択がない場合は `my_reaction: null`。件数が0の種類も必ず返します。
名前・ユーザーID・誰がどれを押したかの一覧は返しません。
件数と本人の選択状態は単一の集計SQLで読み取ります。
公開感想一覧の既存レスポンスは変更せず、必要な感想の件数をこのAPIで取得します。
レスポンスには `Cache-Control: no-store` を付けます。

## 公開範囲と保存

- 指定したGoogle Books IDの、公開用表示名が設定済みの投稿者による `public` 感想だけを対象にします。
- 未認証は401。不正な入力は422。対象なし・非公開・表示名未設定・別の本は同じ404です。
- 非公開や表示名未設定に変わった場合は、取得・追加・切り替え・取り消しも404になります。
- 既存リアクションは保存し、再公開かつ表示名設定済みになれば再び反映します。
- 本文編集後もリアクションは維持します。過去の本文への反応が含まれる場合があります。
- 感想削除・リアクションしたユーザーの削除時は、DBの外部キーで関連行を削除します。
- 本文・解析状態・感想の更新日時・読書進捗・分布件数は変更しません。AI再解析や外部通信もしません。
- DB障害は503。0件や成功した形には置き換えません。書き込み・件数取得に失敗するとロールバックします。

複合主キー `(review_id, user_id)` で1人1種類を保証します。
PostgreSQLでは変更前に親の感想行を `FOR UPDATE` でロックし、
初回の同時追加・切り替え・取り消しを直列化します。
公開設定の変更も同じ親行のロックを使います。
公開用表示名は別コンテキストで取得するため、名前の同時変更と完全に同じスナップショットではありません。
再取得で反映されます。大量アクセス時の性能・実PostgreSQLでの並行実行テストは未実施です。

## 移行とDocker確認

既存データは変更せず、`0013_review_reactions` で空のテーブルを追加します。
ダウングレードはリアクションを削除します。既存の感想・ユーザーは削除しません。

```bash
docker compose up -d
docker compose exec api uv run alembic upgrade head
```

ログインして取得した `access_token` をGit Bashに読み込みます。トークンは共有しないでください。

```bash
read -r -s -p "access_token: " TOKEN
echo
read -r -p "google_books_id: " BOOK_ID
read -r -p "公開感想のid: " REVIEW_ID
REACTION_URL="http://127.0.0.1:8000/catalog/books/$BOOK_ID/reviews/$REVIEW_ID"

curl -sS "$REACTION_URL/reactions" \
  -H "Authorization: Bearer $TOKEN"

curl -sS -X PUT "$REACTION_URL/reaction" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"kind":"empathy"}'

curl -sS -X PUT "$REACTION_URL/reaction" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"kind":"insight"}'

curl -sS -X DELETE "$REACTION_URL/reaction" \
  -H "Authorization: Bearer $TOKEN"
unset TOKEN
```

新規の感想なら、全0件 → 共感した1件 → なるほど1件（共感したは0）→ 全0件を確認します。
既に他の人が押していれば、その人の件数は変えず、自分の分だけが増減します。
同じPUT・DELETEを繰り返しても余分に増減しないことも確認してください。

## 自動検証

```bash
uv run pytest --noconftest tests/reviews/test_reactions.py tests/reviews/test_public_reviews.py tests/reviews/test_visibility.py tests/identity/test_public_profile.py -q
uv run python -X utf8 scripts/check_context_dependencies.py
```

SQLiteと本番composition・アダプターを使って認証・公開条件・本人操作・種類の排他・冪等性・
状態保存・エラーとロールバック・既存APIの回帰を検証します。
移行の制約・削除連動・upgrade/downgradeも検証します。
ロック指定とPostgreSQL向けSQLは検証しますが、SQLiteのテストで実際の行ロック競合は再現しません。
