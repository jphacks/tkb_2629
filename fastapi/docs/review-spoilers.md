# 感想のネタバレ設定

バックエンドのみの追加です。フロントのスイッチや他の読者向けの表示・本文非表示処理は含みません。
公開範囲とは独立して、本人の感想にネタバレを含むかを保存します。

## 移行

`fastapi/` でAPIコンテナ起動後に実行します。

```bash
docker compose exec api uv run alembic upgrade head
docker compose exec api uv run alembic current
```

適用先は `0011_review_spoilers` です。
`page_reviews.contains_spoilers` はNULL不可のbooleanで、既存・新規とも初期値は `true` です。
本文・公開範囲・分析データは変更しません。

## API

本人用の感想取得・一覧・本文保存レスポンスに `contains_spoilers` を追加します。
設定変更は専用APIで行います。

```http
PATCH /books/{book_id}/pages/{page_number}/review/spoilers?iteration=1
Authorization: Bearer <access_token>
Content-Type: application/json

{"contains_spoilers": false}
```

成功時は200と `{"contains_spoilers": false}` を返します。
`true` に戻すことや同じ値の再送も可能です。
`iteration` 省略時は本人の最新回、指定時はその読書回を対象にします。
読了済みの感想も設定変更できます。

- 未認証は401、本人の対象読書回・感想が存在しなければ404（作成しない）
- 不正なページ・読書回・設定値・余分な項目は422
- 設定値はJSON booleanのみ。文字列 `"false"` や数値 `0` / `1` は拒否
- 設定変更はネタバレ設定と更新日時だけを更新
- 本文・公開範囲・進捗・分析状態・分析リビジョンは維持し、分析を実行しない
- 本文保存APIはネタバレ設定を変更しない（省略しても、送っても維持）
- 公開設定変更APIもネタバレ設定を変更しない

`false` にしても感想は公開されません。公開範囲は別の [公開設定API](review-visibility.md) で管理します。
この段階では、他人の感想本文を取得するAPIはありません。

## 検証

```bash
uv run pytest --confcutdir=tests/reviews tests/reviews/test_visibility.py -q
```

既存の公開設定テストと同じ一時SQLite環境でAPI・保存・移行を確認します。
開発用DBは変更しません。PostgreSQL実環境の移行は別途確認してください。
旧構成を参照する親の `tests/conftest.py` を避けるため、`--confcutdir` を指定します。
