# 公開感想の一覧・分布API

公開感想の一覧・全件のページ別分布・保存済みの感情色を提供します。
本の詳細の「他の人のしおり」では、本人を除いた分布と公開感想を表示します。
分布のページを選ぶとそのページの感想を取得します。ネタバレあり・未読ページの本文と色は操作して開きます。
追加のDB移行はありません。公開設定・ネタバレ設定・公開用表示名の既存移行
（`0012_public_display_name` まで）を適用してください。

## 取得

```http
GET /catalog/books/{google_books_id}/reviews?page=42&limit=20&offset=0
Authorization: Bearer <access_token>
```

ログイン必須です。本棚に追加していない本もGoogle Books IDで取得できます。
Google Books IDは空白を含まない1〜256文字です。
DBにそのIDの本がなければ空一覧を返します。IDがGoogle側に存在するかは確認しません。
外部APIへの問い合わせ・書誌の登録・本棚への追加・読書進捗の更新は行いません。
手動登録の本や異なるGoogle Books IDの版は対象外です。

| 項目 | 動作 |
| --- | --- |
| `page` | 省略時は全ページ。指定時は1以上のページ番号と完全一致 |
| `page_start`, `page_end` | 両方指定して範囲を絞る。1以上、開始≦終了、両端を含む。`page` との併用不可 |
| `limit` | 1〜100、初期値20 |
| `offset` | 0以上、初期値0 |
| `exclude_mine` | 初期値false。trueでログイン本人の全読書回を除外。一覧・分布の両方に適用 |
| 順序 | 更新日時の降順、同日時は感想IDの降順 |
| 読書回 | 過去・読了済みを含む全読書回。感想ごとに読書回を返す |
| 投稿者 | 自分を含む。公開用表示名が未設定・空白のみの人は対象外 |
| 公開範囲 | `public` の感想だけ。絞り込み後にページング |

```json
{
  "items": [
    {
      "id": 123,
      "public_display_name": "読書好き",
      "page_number": 42,
      "iteration_number": 1,
      "review_text": "印象に残った場面でした",
      "contains_spoilers": true,
      "created_at": "2026-01-01T00:00:00Z",
      "updated_at": "2026-01-02T00:00:00Z",
      "color_code": "#123456",
      "analysis_status": "completed",
      "source": "jev"
    }
  ],
  "limit": 20,
  "offset": 0
}
```

登録名・メールアドレス・ユーザーID・内部の読書回ID・認証情報は返しません。
感想IDは個別の感想の識別用です。同名の投稿者が同一人物であるとは限りません。
非公開感想は、投稿者本人が閲覧してもこの一覧には含めません。
本人の全感想は従来の本人用APIから取得してください。

**`contains_spoilers` は表示制御用の印であり、公開本文へのアクセス制限ではありません。**
ネタバレありの感想も本文を返します。今後のフロントではネタバレ設定・未読ページに応じて
本文と感情色の初期表示を隠し、閲覧者の操作で開く必要があります。
既存の感想が初期非公開であることは変わりません。
公開への同意と表示名が設定済みなら、このAPIで本文と公開用表示名を閲覧できるようになります。
本APIは表示名設定を促すUIや追加の公開確認操作を実装するものではありません。

後続の取得では非公開への変更・公開用表示名の変更を反映します。
既に受信された内容やスクリーンショットは取り消せません。
レスポンスは `Cache-Control: no-store` です。
コンテキスト間の読み取りは単一スナップショットではなく、同時更新と競合する取得では
一時的なずれがありえます。更新後の再取得で反映されます。
オフセット方式のため、一覧閲覧中に投稿が更新されるとページ間で重複・移動する場合があります。

未認証は401、不正な入力は422、DB障害は503です。
障害を空一覧として扱いません。該当なしは200と `items: []` を返します。
既存の本人用ページ分布・感情集計・本文保存APIは変更しません。

## 個別感想の色

`color_code`・`analysis_status`・`source` を一覧に追加しました。既存フィールドは維持します。
色はユーザー固有の色ではなく、その感想の現在の改訂に対応する保存済み解析結果です。
解析済みの場合のみ、analysisコンテキストの公開契約を通して取得します。
一覧のページング・公開条件・範囲条件を適用した後の感想だけを対象にし、過去改訂の色は使いません。
一覧取得でAIを呼び出したり再解析したりすることはありません。

- `analysis_status=pending` / `failed`: `#808080`、`source=null`。解析待ち・失敗を区別して表示する。
- `analysis_status=completed`, `source=jev`: 保存済み実AIの色。
- `analysis_status=completed`, `source=mock`: 仮の色。実AI解析と誤認させない表示にする。
- 解析済みでも現在の改訂の結果がない場合: `#808080`、`source=null`。結果が未確認であると表示する。
- 解析結果の取得障害: 503。中立色への成功形フォールバックはしない。

感情スコア・内部の解析ID・投稿者のユーザーIDは返しません。
フロントでは全体の分布は単色、個別感想の色は小さなアクセントにする想定です。

## 全件のページ別分布

```http
GET /catalog/books/{google_books_id}/reviews/distribution
```

一覧と同じ認証・公開設定・公開用表示名の条件で、自分と過去の読書回も含めて全感想を集計します。
未読部分の件数も含みます。閲覧者の読書進捗による絞り込みはありません。

```json
{
  "items": [
    {"page_number": 3, "review_count": 2},
    {"page_number": 5, "review_count": 1}
  ],
  "total_count": 3
}
```

`review_count` は人数ではなく感想の件数です。同じ人の複数の読書回もそれぞれ数えます。
ページ昇順で、1件以上あるページだけ返します。0件のページは省略します。
本文・投稿者名・感情色は返さず、SQLのページ別集計で取得します。
一覧の最初の20件から分布を推測するものではありません。解析結果の読み取りも不要です。
未知のGoogle Books IDや対象なしは `{"items":[],"total_count":0}`、未認証は401、
不正なIDは422、集計や公開用表示名の取得障害は503です。`Cache-Control: no-store` を付けます。

フロントは本の総ページ数を別途取得し、右端0・左端総ページの軸に対応させます。
画面幅に応じてページを範囲にまとめ、各範囲内の `review_count` を合算できます。
範囲選択後は、例えば `reviews?page_start=1&page_end=20&limit=20&offset=0`
で本文を取得します。範囲を変えたらoffsetは0に戻してください。
軸の向き・ビンの幅は表示側の責務であり、このAPIのページ番号や件数は変換しません。

分布はページ数に比例したサイズの疎な一覧です。大量の読書回IDは1000件ずつ分割し、
同じIDを重複計上せず合算します。大規模データでの性能ベンチマークは未実施です。
分布と一覧は別リクエストであり、同時に公開設定や本文が変更されると件数がずれることがあります。
再取得で反映し、特定時点の完全なスナップショットとは扱わないでください。

## 確認手順

1. 公開プロフィールの本人用APIで公開用表示名を保存する。
2. 本人用の感想設定APIで、対象感想を `public` にする。
3. `POST /auth/login` で取得した `access_token` を使い、対象本のGoogle Books IDで本APIを取得する。
4. 同じ本の非公開感想や、公開用表示名未設定の投稿者の感想が含まれないことを確認する。
5. `page`・`limit`・`offset` を変え、絞り込み・ページングを確認する。
6. 感想を `private` に戻し、再取得で一覧から外れることを確認する。
7. `/reviews/distribution` を取得し、公開対象の全感想のページ別件数と合計を確認する。
8. `page_start`・`page_end` で選択範囲内だけ取得できることを確認する。
9. ネタバレ設定と独立に、現在の改訂の解析状態・色・実AI/モックの区別が返ることを確認する。

SwaggerにはBearerトークンを設定する仕組みがないため、一覧取得はcurlなどを使います。
Swaggerからログインする場合は、その画面のOrigin（例: `http://localhost:8000`）を
`CORS_ORIGINS` の既存値に追加し、APIコンテナを再作成してください。
`localhost` と `127.0.0.1` は別のOriginです。`/docs` はOriginに含めません。
トークン・パスワードは共有しないでください。

Git Bashでの取得例です。

```bash
read -r -s -p "access_token: " TOKEN
echo
read -r -p "google_books_id: " BOOK_ID
curl -sS -G "http://127.0.0.1:8000/catalog/books/$BOOK_ID/reviews" \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode "limit=20" \
  --data-urlencode "offset=0"
unset TOKEN
```

## 自動テスト

```bash
uv run pytest --noconftest tests/reviews/test_public_reviews.py tests/reviews/test_visibility.py tests/identity/test_public_profile.py -q
uv run python -X utf8 scripts/check_context_dependencies.py
```

一時SQLiteと実際のcomposition factory・アダプターを使い、認証境界・公開範囲・表示名・
ページング・読書回・DB未登録・外部通信なし・既存APIの回帰を検証します。
開発用DBは変更しません。`--noconftest` は旧構成を参照する親のテスト設定を避けるためです。
蔵書・認証認可・感想のORMを横断JOINせず、各コンテキストの公開契約を通して連携します。
