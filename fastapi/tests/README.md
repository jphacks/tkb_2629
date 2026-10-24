# Serviceのモックとテスト

- `conftest.py`: 3つのServiceの `create_autospec(..., instance=True, spec_set=True)` モックと、FastAPIの依存を差し替えるclient fixture。
- `test_service_routes.py`: ServiceをモックにしたHTTP入出力・引数・ステータス・入力検証・認証・例外変換のテスト。現在のURL `/books` を使用。
- `test_services.py`: 実物のServiceにRepository・Analyzerのモックを注入する単体テスト。所有確認、入力検証、本文保存と解析の順序、revisionの受け渡し、失敗時の処理を確認。

DB接続・外部API通信は行いません。モックはテストごとに作成されます。

```bash
uv run pytest tests/test_services.py tests/test_service_routes.py
```
