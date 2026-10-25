# 既存テストについて

このディレクトリのテストは、コンテキスト分離前の `backend.application` / `backend.domain` / `backend.presentation` 等と旧サービスを対象にしています。
現在のコンテキストは `identity` / `library` / `reviews` / `analysis` です。
今回テストコードの書き換え・実行は行っていません。実行する際はimport、fixture、依存注入先、
モックするポートとUnit of Workを新構成へ追従させる必要があります。

ソースの静的依存は、動作テストと独立した次のコマンドで確認できます。

```bash
python3 scripts/check_context_dependencies.py
```

新しい境界と保存・分析の順序は [コンテキスト設計](../docs/contexts.md) を参照してください。
