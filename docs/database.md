# DB設計

## 採用するスキーマ

本番DBはPostgreSQLです。モデルは `fastapi/src/backend/models.py`、初期
マイグレーションは `fastapi/migrations/versions/0001_reading_records.py` にあります。
既存の `users` テーブルは変更せず、読書記録から外部キーで参照します。

### `users`（既存）

既存モデルの `users.id`（整数）をユーザー識別子として使います。既存の
ユーザーCRUDはありますが、ログインやトークン検証はまだありません。読書APIは
将来の信頼済み認証ミドルウェアが設定する `request.state.user_id` を使い、
リクエスト本文からユーザーIDを受け付けません。

### `books`

| カラム | 型 | 制約 |
| --- | --- | --- |
| `id` | integer | 主キー |
| `title` | varchar(255) | 必須、空白のみ不可 |
| `author` | varchar(255) | 任意 |
| `total_pages` | integer | 必須、1以上 |
| `created_at` | timestamptz | 必須、DBが設定 |

書誌情報はユーザー間で共有できます。`POST /api/v1/books` は新規書誌を作成するか、既存の `book_id` と一致する書誌を読書リストに追加します。ISBNによる検索・重複統合は今回の範囲外です。

### `user_books`

| カラム | 型 | 制約 |
| --- | --- | --- |
| `id` | integer | 主キー |
| `user_id` | integer | `users.id` への必須FK、ユーザー削除時 cascade |
| `book_id` | integer | `books.id` への必須FK、書誌削除時 cascade |
| `current_page` | integer | 必須、0以上。APIは本の総ページ数以下も検証 |
| `status` | varchar(16) | `reading` または `completed` |
| `started_at` | timestamptz | 必須、初期値は現在時刻 |
| `completed_at` | timestamptz | 任意。`completed` では必須 |
| `created_at`, `updated_at` | timestamptz | 必須 |

`UNIQUE(user_id, book_id)` により同じ利用者の同じ本の読書記録は1件です。同じ書誌を複数ユーザーが読めます。書誌・ユーザー・進捗検索用に外部キーインデックスを作成します。

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
| `emotion_label` | varchar(64) | 必須 |
| `color_code` | varchar(7) | `#RRGGBB` 形式 |
| `confidence` | float | 任意、0以上1以下 |
| `model_version` | varchar(128) | 任意 |
| `source` | varchar(16) | `mock` / `jev` |
| `created_at` | timestamptz | 必須 |

`UNIQUE(review_id, review_revision)` により1 revisionに分析結果は最大1件です。
APIは現在のrevisionと一致する分析だけ返します。更新後に遅れて完了した古い分析は
条件付き更新に失敗し、最新結果として表示されません。現在の分析は
`source=mock`, `model_version=mock-v1` と明示され、Jevの実結果とは区別します。

## マイグレーションと既存DB

`fastapi/migrations` はAlembicです。接続先を `DATABASE_URL` に設定し、
`fastapi/` から `uv run alembic upgrade head` を実行します。既存の `users` や
`create_all` が先に作成した読書テーブルは再作成しません。テーブル単位で既存有無を
確認するため、部分的に異なるスキーマの場合は適用前に管理者が実DBを調査してください。
downgradeはデータのある読書テーブルを削除せず、エラーで停止します。

このマイグレーションは `users` がない新規DBでは、既存モデルと同じ最小の `users` テーブルも作成します。既存 `users` テーブルにカラム変更やデータ削除は行いません。

## 将来の拡張

認証機能、ISBNによる書誌統合、ページ単位の分析再試行、Jevアダプターは別途対応します。認証方式やアカウント削除方針を確定した後に、ユーザーIDの契約を固定してください。
