# 開発環境の起動

このディレクトリに `.env` を作成し、Compose内のPostgreSQLへの接続先を設定します。

```dotenv
DATABASE_URL=postgresql+psycopg://postgres:postgres@postgres:5432/fastapi
```

```bash
docker compose up --build
```

Apply the database schema through Alembic after the services are healthy:

```bash
docker compose exec api uv run alembic upgrade head
```

For a database previously initialized by `create_all()`, do not run this command until its
schema has been compared with revision `0001_reading_records` and a backup has been made.
The initial migration intentionally stops when it finds pre-existing tables without Alembic
history. Baseline stamping requires that review first.

起動後は http://localhost:8000/docs でAPIを確認できます。
Dockerfileの起動コマンドを変更した場合も、`--build` を付けてイメージを再ビルドしてください。

起動に失敗する場合は次のコマンドで状態とログを確認できます。

```bash
docker compose ps -a
docker compose logs --tail 100 api postgres
```

PostgreSQLの既存ボリュームがある場合、`POSTGRES_DB` を変更しても新しいデータベースは作成されません。
ログに `database "fastapi" does not exist` と出る場合は、既存データベース名と接続先を合わせるか、必要なデータベースを作成してください。

## コード構成

本人用の公開用表示名APIについては [公開用表示名](docs/public-profile.md) を参照してください。
ログイン済みの読者向けの感想取得・範囲絞り込み・全件分布・感情色は
[公開感想一覧・分布API](docs/public-reviews.md) を参照してください。

構成と境界の詳細は [コンテキスト設計](docs/contexts.md) を参照してください。

- `src/backend/identity/`: 認証認可・プロフィール・本人操作の認可。
- `src/backend/library/`: 書誌、Google Books、蔵書、読書回、読了、進捗。
- `src/backend/reviews/`: 感想本文、改訂、解析状態、感想とページ別集計。
- `src/backend/analysis/`: Jev/モック、感情モデル、色変換、分析履歴と感情集約。
- `src/backend/composition/`: 環境設定・依存注入・全ORM登録のcomposition root。
- `src/backend/integration/`: 各コンテキストの公開契約を変換するアダプター。
- `src/backend/shared/`: DB接続、共通メタデータ、技術的なUnit of Work、HTTP認証境界。
- `src/backend/infrastructure/migrations/`: 既存Alembic履歴。配置とテーブル定義は維持します。

各コンテキストは `presentation → application → domain` の依存を持ち、
infrastructureは自身のapplication/domainのポートを実装します。他コンテキストを直接importしません。
ユースケースがUnit of Work経由でトランザクションを制御し、Repositoryはcommitしません。
感想本文と進捗は同時に確定し、DBトランザクションを閉じてからJev分析を呼び出します。
現在の改訂番号と一致する結果のみ表示し、分析失敗時も本文を保持します。

`Book` のレスポンスは書籍情報のみ、`Review` は `color_code` を直接返します。
読書進捗の更新APIは削除しました。
本棚の所有関係・分析履歴はDB内部で管理します。
感想レスポンスには `analysis_status` と `source` を含め、
実AI（jev）・モック（mock）・解析待ち／失敗をクライアントが区別できます。
感想の `visibility` は初期値が `private` で、本人だけが専用APIで変更できます。
移行・API・検証手順は [感想の公開設定](docs/review-visibility.md) を参照してください。
`contains_spoilers` は初期値が `true` で、公開範囲とは独立して本人だけが変更できます。
詳細は [感想のネタバレ設定](docs/review-spoilers.md) を参照してください。
`GET /books/{book_id}/reviews` は本人の指定読書回（省略時は最新回）の感想一覧を
ページ番号順で返します。`limit` は1〜100、`offset` は0以上です。
既存DBとの互換性のため、進捗用のDBカラムと既存マイグレーションは維持しています。
分析が未完了・失敗の場合、`color_code` は既定色 `#808080` を返します。

読書APIは `/books` と `/books/{book_id}/pages/{page_number}/review` に配置します。
旧 `/api/v1/books` は提供しないため、クライアントの呼び出し先を変更してください。
Google Books由来の書誌情報はRedisキャッシュを優先し、未取得・期限切れの場合に外部APIから取得します。
感想保存時のJev感情分析は引き続き行います。
APIの更新は省略可能な項目追加を基本とし、必須項目・型・意味の変更や削除は破壊的変更として移行手順を用意します。
URLのバージョン番号と外部API通信の有無は独立した事項です。

`GET /fetch?query=...` はGoogle Books APIからタイトル候補を検索します。
ページ数を取得できる候補だけを返し、`BOOKS_API` が設定されている場合はAPIキーを使用します。
候補の `google_books_id` を `POST /books/import` に送ると、バックエンドが書誌を再取得して
共有書誌と現在のユーザーの本棚へ登録します。Google Books IDが同じ書誌は既存の
`books` 行を再利用するため、タイトルの表記揺れによる重複を防ぎます。
検索自体に認証やDB接続は不要ですが、本棚への追加には認証とDB接続が必要です。

Google Books由来のタイトル・著者・ページ数・ISBN・表紙URLはDBへ保存しません。
`books` へ永続化する外部書誌情報は `google_books_id` のみです。本棚表示、書籍詳細、
感想のページ範囲検証ではIDを使ってGoogle Books APIから書誌情報を取得します。
取得した書誌情報はGoogle Books IDをキーとしてRedisへ保存し、以降はキャッシュを優先します。
検索結果も本ごとに保存するため、検索後の登録・表示で再利用できます。
有効期限はAPI取得から24時間（86,400秒）で、RedisのTTLにより自動削除します。
キャッシュ参照では期限を延長しません。期限切れ・キャッシュ未登録時はAPIから再取得します。
確認したGoogle Books APIの正常応答には`Cache-Control`・`Expires`による期限の明示がなかったため、同じ書誌情報の繰り返し取得を減らすアプリ側の運用方針として24時間を設定しています。
規約上の保存許可期間を示す設定ではありません。設定理由は[ルートREADMEの技術構成](../README.md#技術構成)を参照してください。
検索リクエスト自体はキャッシュせず、検索結果に含まれる本ごとの書誌情報をキャッシュします。
変更前に作成されたキャッシュのTTLは自動では短縮されません。既存環境へ反映する際は、`google_books:v1:*`の書誌キャッシュを削除して再取得するか、残りTTLを24時間以下へ短縮してください。
Redis障害時はAPIから取得し、キャッシュ障害をログに記録します。
接続先は `REDIS_URL`（既定値 `redis://localhost:6379/0`）で設定します。
Docker ComposeではRedisも起動し、APIの接続先を `redis://redis:6379/0` に設定します。
APIキーはバックエンドだけで使用します。
ユーザーのメール重複などDB制約との競合は409で返します。
読書APIはBearer JWTを検証し、認証認可コンテキストから既存の `user_id` を取得します。
登録・ログイン・メール確認・パスワード再設定は `/auth` にあります。
感情分析は `TYPESAFE_API_KEY` が設定されている場合にJevを使い、8感情の強度から色を生成します。
未設定の場合はモックを使い、`#8C8C8C` を返します。
感情ベクトル・投影座標・モデル情報はDBに保存し、APIは `color_code` を返します。

## 静的チェック

```bash
python3 scripts/check_context_dependencies.py
uv run ruff check src/backend scripts
```

今回は動作テストを実行していません。旧構成向けのテストは新ポート・サービスへの追従が必要です。
詳しくは [tests/README.md](tests/README.md) を参照してください。
`Protocol` はインターフェースの形を定義し、`Unit of Work` はユースケース単位のトランザクションを表します。
`composition/` が実装を組み立て、`presentation/dependencies.py` は注入先のスロットのみを定義します。

感想本文は前後の空白を除去した後、1〜140文字に制限します。

## 感情解析結果とDBスキーマ

`reviews.application.ReviewService` は保存済み本文と改訂番号を自身の `AnalysisGateway` に渡します。
`integration/reviews_analysis.py` がAI分析コンテキストの公開APIへ変換します。
Jevの8スコアを0〜1に正規化し、AIドメインの `EmotionResult.from_vector()` が投影座標と色を計算します。
分析結果はAI側のUnit of Workで `emotion_analyses` に保存し、感想側は自身の解析状態のみ更新します。

`src/backend/infrastructure/migrations/` はDBスキーマの履歴であり、リクエストごとに実行する解析処理ではありません。
0002はvalence/arousalとパレット版、0003は8感情、0004は投影座標を追加します。
現在の8感情解析ではvalence/arousalは未使用のためNULLになります。
APIを使う前に `uv run alembic upgrade head`（Dockerでは上記のexecコマンド）で
0009まで適用してください。0007は既存の読書記録を1回目として扱い、同じ本の再読履歴、
読了状態、最新の読書回だけを使うページ別集計を追加します。アプリ起動時の `create_all()` は行いません。
既存DBでAlembic履歴がない場合は、冒頭のスキーマ確認・バックアップ手順に従ってください。

DBマイグレーションはinfrastructure層に配置しています。
`alembic.ini` の `script_location` がこのディレクトリを参照するため、
既存のAlembicコマンドは同じまま使えます。
マイグレーションはAlembicから実行し、domain・applicationやAPI処理からはimportしません。
過去のスキーマ変更を再現できるよう、revision ID・適用順序・各revisionの実装は維持しています。

エンドポイントごとの処理・レスポンス・未実装機能は [docs/endpoints.md](docs/endpoints.md) を参照してください。

## 認証認可コンテキスト

実装と設定は [docs/authentication.md](docs/authentication.md) を参照してください。
`src/backend/identity/` に domain / application / infrastructure / presentation を分離しています。
`composition/identity.py` で依存を組み立て、`integration/identity.py` で共通HTTP認証ポートに接続します。
ドメイン層は標準ライブラリのみ、アプリケーション層はdomainと同層のみに依存します。
既存の読書コンテキストへは、検証済みの整数 `user_id` のみを渡します。
開発用認証バイパス（`AUTH_DISABLED` / `DEV_USER_ID`）は廃止しました。
`POST /users` は廃止し、ユーザー登録は `POST /auth/register` を使用します。
開発時は `APP_ENV=development` で [DB直接登録CLI](docs/authentication.md#開発用ユーザーをdbに直接作成) を使うと、
SMTPなしで確認済みのユーザーを作成し、通常のログイン画面から利用できます。

## 感情スコアの保存形式

`emotion_analyses` の `joy`・`trust`・`fear`・`surprise`・`sadness`・`disgust`・`anger`・`anticipation` は、各感情の強度を独立した0〜100の整数で保存します（合計100ではありません）。0〜1の分析値を100倍して四捨五入し、色の算出には丸める前の分析値を使います。
0008のマイグレーションは既存の0〜1の保存値も同じ方法で変換し、未保存のNULLは維持します。APIレスポンスは従来どおり `color_code` を返します。
