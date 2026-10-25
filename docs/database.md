# DB設計

## 採用するスキーマ

本番DBはPostgreSQLです。モデルは `fastapi/src/backend/{identity,library,reviews,analysis}/infrastructure/models.py` に分かれ、
`composition/schema.py` が共通メタデータへ登録します。初期マイグレーションは
`fastapi/src/backend/infrastructure/migrations/versions/0001_reading_records.py` にあります。
既存の `users` テーブルは変更せず、読書記録から外部キーで参照します。

### `users`（既存）

既存モデルの `users.id`（整数）をユーザー識別子として使います。認証認可コンテキストがユーザー・認証情報を所有します。読書APIはBearer JWTとセッションを検証して本人のIDを取得し、
リクエスト本文からユーザーIDを受け付けません。認証用テーブルは [認証設定](../fastapi/docs/authentication.md) を参照してください。

### `books`

| カラム | 型 | 制約 |
| --- | --- | --- |
| `id` | integer | 主キー |
| `title` | varchar(255) | 手動登録書籍のみ必須。Google Books書籍ではNULL |
| `author` | varchar(255) | 手動登録書籍のみ使用 |
| `total_pages` | integer | 手動登録書籍のみ必須。Google Books書籍ではNULL |
| `google_books_id` | varchar(128) | 任意、Google Booksのvolume ID、一意 |
| `created_at` | timestamptz | 必須、DBが設定 |

書誌情報はユーザー間で共有できます。`POST /books/import` はGoogle Booksのvolume IDで
書誌を再取得し、Google Books IDが一致する既存行を再利用します。
これにより、利用者が入力したタイトルの表記揺れによる重複を防ぎます。
Google Books由来のタイトル・著者・ページ数・ISBN・表紙URLはDBへ保存せず、
表示とページ範囲検証の都度Google Books APIから取得します。書誌は蔵書コンテキストのRedisアダプターで30日間キャッシュし、期限切れ時に再取得します。
既存の `POST /books` は手動登録との後方互換性のため維持します。

### `user_books`

| カラム | 型 | 制約 |
| --- | --- | --- |
| `id` | integer | 主キー |
| `user_id` | integer | `users.id` への必須FK、ユーザー削除時 cascade |
| `book_id` | integer | `books.id` への必須FK、書誌削除時 cascade |
| `iteration_number` | integer | 必須、1以上。同じ本の読書回数 |
| `current_page` | integer | 必須、0以上。APIは本の総ページ数以下も検証 |
| `status` | varchar(16) | `reading` または `completed` |
| `started_at` | timestamptz | 必須、初期値は現在時刻 |
| `completed_at` | timestamptz | 任意。`completed` では必須 |
| `last_read_at` | timestamptz | 任意。しおり本文の最終保存日時。未記録はNULL |
| `created_at`, `updated_at` | timestamptz | 必須 |

`UNIQUE(user_id, book_id, iteration_number)` により読書回の重複を防ぎ、部分一意インデックスで同じ利用者・本の読書中の回を1件に制限します。同じ書誌を複数ユーザーが読めます。書誌・ユーザー・進捗検索用に外部キーインデックスを作成します。

`0014_last_read_at` は読書回ごとに最終しおり保存日時を追加し、
`(user_id, status, last_read_at)` のインデックスを作成します。
既存日時を推測するバックフィルは行いません。本文・進捗と同じトランザクションで更新し、
再読開始時はNULLに戻ります。並び順・更新対象の詳細は
[「続きを読む」API](../fastapi/docs/endpoints.md#続きを読むの並び順) を参照してください。

### `page_reviews`

| カラム | 型 | 制約 |
| --- | --- | --- |
| `id` | integer | 主キー |
| `user_book_id` | integer | `user_books.id` への必須FK、親削除時 cascade |
| `page_number` | integer | 必須、1以上かつ本のページ数以下（後者はAPIで検証） |
| `review_text` | text | 必須、空白のみ不可 |
| `analysis_revision` | integer | 必須。感想更新ごとに増加 |
| `analysis_status` | varchar(16) | `pending` / `completed` / `failed` |
| `created_at`, `updated_at` | timestamptz | 必須 |

`UNIQUE(user_book_id, page_number)` が同じ読書記録・ページの重複をDBレベルで防ぎます。空の感想を保存せず、感想のないページにはレコードを作りません。

### `emotion_analyses`

| カラム | 型 | 制約 |
| --- | --- | --- |
| `id` | integer | 主キー |
| `review_id` | integer | `page_reviews.id` への必須FK、親削除時 cascade |
| `review_revision` | integer | 必須。分析対象の感想revision |
| `emotion_label` | varchar(64) | 任意。連続値分析ではNULL |
| `color_code` | varchar(7) | `#RRGGBB` 形式 |
| `confidence` | float | 任意、0以上1以下 |
| `model_version` | varchar(128) | 任意 |
| `source` | varchar(16) | `mock` / `jev` |
| `joy` | float | 任意、0〜1の喜び強度 |
| `trust` | float | 任意、0〜1の信頼強度 |
| `fear` | float | 任意、0〜1の恐れ強度 |
| `surprise` | float | 任意、0〜1の驚き強度 |
| `sadness` | float | 任意、0〜1の悲しみ強度 |
| `disgust` | float | 任意、0〜1の嫌悪強度 |
| `anger` | float | 任意、0〜1の怒り強度 |
| `anticipation` | float | 任意、0〜1の期待強度 |
| `palette_version` | varchar(32) | 任意。色変換ルールの識別子 |
| `created_at` | timestamptz | 必須 |

`UNIQUE(review_id, review_revision)` により1 revisionに分析結果は最大1件です。
APIは現在のrevisionと一致する分析だけ返します。更新後に遅れて完了した古い分析は
条件付き更新に失敗し、最新結果として表示されません。現在の分析は
`source=mock` または `source=jev` で区別します。Jev Scoreの値は0〜4を0〜1へ正規化し、
8感情ベクトルとして保存します。`palette_version` により、同じベクトルから同じ色を
再現できます。confidenceには8質問のうち最も低い値を保存します。旧 `valence` / `arousal`
列は既存データ互換のため残し、新しい分析では使用しません。

## マイグレーションと既存DB

`fastapi/migrations` はAlembicです。接続先を `DATABASE_URL` に設定し、
`fastapi/` から `uv run alembic upgrade head` を実行します。連続値の追加は
`0002_continuous_affect`、8感情列の追加は `0003_eight_emotion_scores` で行います。
既存の `users` や
`create_all` が先に作成した読書テーブルは再作成しません。テーブル単位で既存有無を
確認するため、部分的に異なるスキーマの場合は適用前に管理者が実DBを調査してください。
downgradeはデータのある読書テーブルを削除せず、エラーで停止します。

このマイグレーションは `users` がない新規DBでは、既存モデルと同じ最小の `users` テーブルも作成します。既存 `users` テーブルにカラム変更やデータ削除は行いません。

## 将来の拡張

色相の初期割り当てはanger 0°、anticipation 30°、joy 60°、trust 120°、fear 180°、
surprise 240°、sadness 270°、disgust 300°です。これはバージョン付きの暫定パレットで、
画像の正確な色値に校正したものではありません。認証機能、ISBNによる書誌統合、ページ単位の分析再試行は別途対応します。JevのAPIキーは
`TYPESAFE_API_KEY` 環境変数で設定します。認証方式やアカウント削除方針を確定した後に、
ユーザーIDの契約を固定してください。
