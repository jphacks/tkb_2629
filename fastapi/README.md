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

依存の方向は `presentation → application → domain` です。
`infrastructure` は application のRepository抽象クラスを実装し、
`presentation/dependencies.py` でユースケースへ注入します。

- `src/backend/domain/`: フレームワークに依存しないエンティティ、値オブジェクト、業務例外、感情分析インターフェース。ページ範囲・書籍情報・感想本文のルールを保持します。
- `src/backend/application/`: ユーザー管理・本棚・感想保存のユースケースとRepository抽象クラス。
- `src/backend/infrastructure/`: SQLAlchemyモデル、DB接続、Repository実装、Jev・モック感情分析。
- `src/backend/presentation/`: FastAPIルート、入出力スキーマ、認証コンテキストの取得、依存の組み立て。
- `src/backend/main.py`: アプリケーション生成、業務例外のHTTP変換。
- `src/backend/infrastructure/migrations/`: AlembicのDBマイグレーション。既存テーブル定義は維持しています。

Repositoryはトランザクションを管理します。感想本文は分析前に確定し、
分析結果は保存時のリビジョンが一致する場合だけ反映します。
分析失敗時も本文を保持し、過去の分析結果を現在の結果として返しません。

`Book` のレスポンスは書籍情報のみ、`Review` は `color_code` を直接返します。
読書進捗の更新APIは削除しました。
本棚の所有関係・分析状態・分析履歴はDB内部で管理し、レスポンスには含めません。
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
有効期限はAPI取得から30日（2,592,000秒）で、RedisのTTLにより自動削除します。
キャッシュ参照では期限を延長しません。期限切れ・キャッシュ未登録時はAPIから再取得します。
Redis障害時はAPIから取得し、キャッシュ障害をログに記録します。
接続先は `REDIS_URL`（既定値 `redis://localhost:6379/0`）で設定します。
Docker ComposeではRedisも起動し、APIの接続先を `redis://redis:6379/0` に設定します。
APIキーはバックエンドだけで使用します。
ユーザーのメール重複などDB制約との競合は409で返します。
読書APIの認証は、信頼できるミドルウェアが設定する `request.state.user_id` を前提とします。
ログイン処理や当該ミドルウェアはまだ実装されていません。
感情分析は `TYPESAFE_API_KEY` が設定されている場合にJevを使い、8感情の強度から色を生成します。
未設定の場合はモックを使い、`#8C8C8C` を返します。
感情ベクトル・投影座標・モデル情報はDBに保存し、APIは `color_code` を返します。

## テスト・静的チェック

```bash
uv run pytest
uv run ruff check .
uv run ruff format --check .
```

テストはSQLiteを使用し、PostgreSQLや開発サーバーの起動は不要です。

## Java / Kotlinから読む場合

- `ABC` と `@abstractmethod` は抽象クラス・抽象メソッドです。Repositoryと分析器の実装は明示的に継承します。
- `@dataclass` はフィールドからコンストラクターや等価比較などを生成する仕組みです。`frozen=True` の結果クラスはJavaのrecordやKotlinのデータクラスに近い用途です。
- 保存結果は `ReviewTextSaveResult`・`ReviewSaveResult` にまとめ、フィールド名で参照します。
- 値オブジェクトは通常のコンストラクターで入力を検証・正規化し、読み取り専用の `@property` で値を公開します。`@dataclass(init=False)` は自動コンストラクターを使わず、等価比較などの生成だけを利用する指定です。
- `Book | None` はnullを許容する型です。Kotlinの `Book?` に相当します。
- `Annotated` と `Depends` はFastAPIの型に付ける注入設定です。依存の組み立ては `presentation/dependencies.py` にあります。
- DB依存の `yield` はFastAPIのライフサイクル規約です。セッションを渡し、リクエスト終了後に `finally` で閉じます。

感想本文は前後の空白を除去した後、1〜140文字に制限します。

## 感情解析結果とDBスキーマ

`ReviewService.save()` は正規化した本文を `EmotionAnalyzer.analyze()` に渡し、
戻り値の `EmotionResult` を `analysis_result` に受け取ります。
Jev実装は外部APIの8感情スコアを0〜1に正規化し、ドメインの
`EmotionResult.from_vector()` が投影座標と色を計算します。
Repositoryの `complete()` はその結果を `emotion_analyses` に保存します。

`src/backend/infrastructure/migrations/` はDBスキーマの履歴であり、リクエストごとに実行する解析処理ではありません。
0002はvalence/arousalとパレット版、0003は8感情、0004は投影座標を追加します。
現在の8感情解析ではvalence/arousalは未使用のためNULLになります。
APIを使う前に `uv run alembic upgrade head`（Dockerでは上記のexecコマンド）で
0007まで適用してください。0007は既存の読書記録を1回目として扱い、同じ本の再読履歴、
読了状態、最新の読書回だけを使うページ別集計を追加します。アプリ起動時の `create_all()` は行いません。
既存DBでAlembic履歴がない場合は、冒頭のスキーマ確認・バックアップ手順に従ってください。

DBマイグレーションはinfrastructure層に配置しています。
`alembic.ini` の `script_location` がこのディレクトリを参照するため、
既存のAlembicコマンドは同じまま使えます。
マイグレーションはAlembicから実行し、domain・applicationやAPI処理からはimportしません。
過去のスキーマ変更を再現できるよう、revision ID・適用順序・各revisionの実装は維持しています。

エンドポイントごとの処理・レスポンス・未実装機能は [docs/endpoints.md](docs/endpoints.md) を参照してください。

## 開発時の認証スキップ

認証なしでDB保存を確認する場合は、先に `POST /users` でユーザーを作成し、
返されたIDを `.env` の `DEV_USER_ID` に設定します。

```dotenv
APP_ENV=development
AUTH_DISABLED=true
DEV_USER_ID=1
```

Dockerでは設定変更後に `docker compose up -d --force-recreate api` で環境変数を反映します。
ローカル実行ではこれらを環境変数として渡してください（この認証処理は `.env` を直接読みません）。
この状態では `/books` などの読書APIが固定ユーザーの本棚を操作します。
指定ユーザーを自動作成する処理はありません。

`.env.example` はローカルUIをすぐ確認できるよう、開発環境限定のバイパスを有効にしています。
`DEV_USER_ID` のユーザーは自動作成されないため、先に `POST /users` で作成してください。
`AUTH_DISABLED` は未設定または `false` なら通常の認証処理です。
`true` の場合でも `APP_ENV=development` と正の整数の `DEV_USER_ID` が必要で、
設定不正の場合は503を返して処理を止めます。本番環境では `AUTH_DISABLED=false` にしてください。
