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
