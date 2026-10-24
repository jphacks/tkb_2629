# 開発環境の起動

このディレクトリに `.env` を作成し、Compose内のPostgreSQLへの接続先を設定します。

```dotenv
DATABASE_URL=postgresql+psycopg://postgres:postgres@postgres:5432/fastapi
```

```bash
docker compose up --build
```

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
- `src/backend/infrastructure/`: SQLAlchemyモデル、DB接続、Repository実装、モック感情分析。
- `src/backend/presentation/`: FastAPIルート、入出力スキーマ、認証コンテキストの取得、依存の組み立て。
- `src/backend/main.py`: アプリケーション生成、業務例外のHTTP変換、起動時のテーブル作成。
- `migrations/`: AlembicのDBマイグレーション。既存テーブル定義は維持しています。

Repositoryはトランザクションを管理します。感想本文は分析前に確定し、
分析結果は保存時のリビジョンが一致する場合だけ反映します。
分析失敗時も本文を保持し、過去の分析結果を現在の結果として返しません。

`Book` のレスポンスは書籍情報のみ、`Review` は `color_code` を直接返します。
読書進捗の更新APIは削除しました。
本棚の所有関係・分析状態・分析履歴はDB内部で管理し、レスポンスには含めません。
既存DBとの互換性のため、進捗用のDBカラムと既存マイグレーションは維持しています。
分析が未完了・失敗の場合、`color_code` は既定色 `#808080` を返します。

`GET /fetch` はGoogle Books API連携用の入口です。現在は501を返し、
検索条件・成功レスポンス・外部通信は未実装です。認証やDB接続は不要です。
ユーザーのメール重複などDB制約との競合は409で返します。
読書APIの認証は、信頼できるミドルウェアが設定する `request.state.user_id` を前提とします。
ログイン処理や当該ミドルウェアはまだ実装されていません。
感情分析は固定結果を返すモックです。

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
