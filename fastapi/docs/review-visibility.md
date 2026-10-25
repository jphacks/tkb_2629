# 感想の公開設定

この段階はバックエンドのみの変更です。ネタバレ設定・公開感想一覧・リアクション・DM・フロント変更は含みません。

## DB移行

`fastapi/` で実行します。

```bash
docker compose exec api uv run alembic upgrade head
```

`0010_review_visibility` は `page_reviews.visibility` を追加します。
既存・新規の感想は `private` が初期値です。許可値は `private` と `public` のみです。
アプリを新しいコードで使用する前に移行してください。

## API

感想の取得・一覧・本文保存レスポンスに `visibility` が追加されます。
既存の本文保存APIは変更せず、公開範囲の更新は専用APIで行います。
本文保存時に `visibility` を省略しても、既存設定を維持します。
本文保存APIへ `visibility` を送っても設定は変わりません。

```http
PATCH /books/{book_id}/pages/{page_number}/review/visibility?iteration=1
Authorization: Bearer <access_token>
Content-Type: application/json

{"visibility": "public"}
```

成功時は200と `{"visibility": "public"}` を返します。
`private` を指定すれば非公開に戻せます。同じ設定の再送も可能です。
`iteration` は省略時に本人の最新の読書回を対象とします。
過去・読了済みの読書回も設定変更できます。

- 未認証: 401
- 本人の対象読書回・感想が存在しない: 404（新規作成しない）
- 不正な公開範囲・ページ・読書回、設定以外の余分な項目: 422
- 設定変更は本文・読書進捗・分析結果・分析リビジョンを変更せず、分析を実行しない
- 設定変更は公開範囲と更新日時のみを更新する

**`public` かつ公開用表示名が設定済みなら、[公開感想一覧API](public-reviews.md) で他の読者が本文と公開用表示名を閲覧できます。**
既存の本人用取得APIは `public` でも本人以外へ本文を返しません。
既存のページ分布・感情集計の仕様は今回変更しません。
公開感想一覧APIはこの設定で絞り込みます。公開用集計APIはまだ追加していません。

## 検証

```bash
uv run pytest --confcutdir=tests/reviews tests/reviews/test_visibility.py -q
```

一時SQLite DBで保存・更新・本人の読書回によるアクセス制御・移行を検証し、
開発用DBは変更しません。PostgreSQL実環境への移行は別途確認してください。
既存の `tests/conftest.py` は旧モジュール `backend.application.services` を参照して
収集時に失敗するため、このテストは現在のコンテキスト構成に合わせて独立実行します。
