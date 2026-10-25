# 公開感想の一覧API

バックエンドのみの追加です。公開感想を表示するフロント・ページ分布・リアクション・DMは含みません。
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
| `limit` | 1〜100、初期値20 |
| `offset` | 0以上、初期値0 |
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
      "updated_at": "2026-01-02T00:00:00Z"
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
初期表示を隠し、閲覧者の操作で開く必要があります。
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
既存のページ分布・感情集計・本文保存APIは変更しません。

## 確認手順

1. 公開プロフィールの本人用APIで公開用表示名を保存する。
2. 本人用の感想設定APIで、対象感想を `public` にする。
3. `POST /auth/login` で取得した `access_token` を使い、対象本のGoogle Books IDで本APIを取得する。
4. 同じ本の非公開感想や、公開用表示名未設定の投稿者の感想が含まれないことを確認する。
5. `page`・`limit`・`offset` を変え、絞り込み・ページングを確認する。
6. 感想を `private` に戻し、再取得で一覧から外れることを確認する。

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
