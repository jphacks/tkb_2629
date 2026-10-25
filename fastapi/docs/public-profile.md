# 公開用表示名（本人用API）

登録名 `name` と別に `public_display_name` を保存します。
既存・新規とも初期値はNULL（未設定）で、登録名やメールアドレスを自動転用しません。
この段階ではフロント・アイコン・写真アップロード・公開感想一覧は実装しません。

## 移行

`fastapi/` でAPIコンテナを起動してから実行します。

```bash
docker compose exec api uv run alembic upgrade head
docker compose exec api uv run alembic current
```

適用先は `0012_public_display_name` です。既存の登録名・メール・感想は変更しません。

## API

どちらもログイン必須で、認証された本人の情報だけを扱います。
URLや本文で他のユーザーIDを指定することはできません。

```http
GET /users/me/public-profile
Authorization: Bearer <access_token>
```

未設定の場合は200と `{"public_display_name": null}` を返します。

```http
PUT /users/me/public-profile
Authorization: Bearer <access_token>
Content-Type: application/json

{"public_display_name": "読書好き"}
```

成功時は200と `{"public_display_name": "読書好き"}` を返します。
返すのは公開用表示名だけで、登録名・メールアドレスは含めません。

- 既存の登録名と同じ検証ルールで、前後の空白を除いて1〜100文字
- 同じ表示名を複数ユーザーが使用可能（識別子・ログイン名ではない）
- 後から変更可能。同じ値の再送も可能
- NULL・空文字への変更は不可。この段階では設定解除APIは提供しない
- 未認証は401、ユーザーが存在しなければ404、不正な値・余分な項目は422
- 登録名の更新と公開用表示名の更新は互いに影響しない
- ログイン・既存の本人用プロフィールAPIのレスポンスは変更しない

**今回のAPIは将来の公開表示に使う名前を本人が選ぶためのもので、名前自体を他の読者へ公開するAPIではありません。**
感想が `public` で表示名が設定済みなら、[公開感想一覧API](public-reviews.md) が感想とこの表示名を返します。
未設定の場合は対象外で、登録名へフォールバックしません。
追加の公開前確認UIはまだ実装していません。表示名を変更すると、既存の公開感想にも新しい名前が表示されます。

## 検証

```bash
uv run pytest --confcutdir=tests/identity tests/identity/test_public_profile.py -q
```

一時SQLiteでAPI・保存・移行を確認します。開発用DBは変更しません。
PostgreSQL実環境への移行は別途確認してください。
旧構成を参照する親の `tests/conftest.py` を避けるため、`--confcutdir` を指定します。
