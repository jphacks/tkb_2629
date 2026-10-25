# 公開用表示名（本人用API）

アカウント名と公開名を1つの表示名に統一します。互換性のためDBの `name` と
`public_display_name`、既存APIのレスポンス形式は残します。
既存の公開名があれば、ログイン・本人プロフィールはその名前を `name` として返します。
データ移行で非公開の登録名をコピーしたり、既存行を書き換えたりしません。
公開名が未設定なら、本人が明示的に設定するまでNULLを維持します。
フロントの名前入力統一・公開の説明は別ブランチで対応します。

## 新規登録

`POST /auth/register` に厳密なbooleanの `name_is_public` を追加しました。
新フロントは入力名が他の読者にも表示されることを説明してから `true` を送ります。
この場合のみ、trimした `name` を公開名として同じ登録トランザクション内で保存します。
省略・`false` は未設定のままです。公開説明のない旧クライアントとの安全な互換性を保ちます。
`null`・文字列・数値は422です。メール確認・パスワードの仕様は変わりません。

## 移行

`fastapi/` でAPIコンテナを起動してから実行します。

```bash
docker compose exec api uv run alembic upgrade head
docker compose exec api uv run alembic current
```

公開名カラムは `0012_public_display_name` で追加済みです。名前統一の追加移行は不要です。

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
返すのは公開用表示名だけで、メールアドレスは含めません。
この明示的な設定で `name` も同じ値に更新します。

- 既存の登録名と同じ検証ルールで、前後の空白を除いて1〜100文字
- 同じ表示名を複数ユーザーが使用可能（識別子・ログイン名ではない）
- 後から変更可能。同じ値の再送も可能
- NULL・空文字への変更は不可。この段階では設定解除APIは提供しない
- 未認証は401、ユーザーが存在しなければ404、不正な値・余分な項目は422
- `PUT /users/{user_id}` でも公開名設定済みなら両方の名前を同時更新します
- 未設定の人の `PUT /users/{user_id}` は登録名だけを変更し、公開の同意とは扱いません
- 2つの変更経路は同じユーザー行をロックして直列化します。失敗時は両方ロールバックします
- ログイン・既存の本人用プロフィールのレスポンス形式は維持します。名前は設定済み公開名を優先します

**今回のAPIは将来の公開表示に使う名前を本人が選ぶためのもので、名前自体を他の読者へ公開するAPIではありません。**
感想が `public` で表示名が設定済みなら、[公開感想一覧API](public-reviews.md) が感想とこの表示名を返します。
未設定の場合は対象外で、登録名へフォールバックしません。
表示名を変更すると、既存の公開感想にも新しい名前が表示されます。
旧フロントで別々に見える入力欄も、公開名設定後は同じ名前の更新となります。
フロントの統一時には、設定画面でもこの公開範囲を明示してください。

## 検証

```bash
uv run pytest --confcutdir=tests/identity tests/identity/test_public_profile.py -q
```

一時SQLiteでAPI・保存・移行を確認します。開発用DBは変更しません。
PostgreSQL実環境への移行は別途確認してください。
旧構成を参照する親の `tests/conftest.py` を避けるため、`--confcutdir` を指定します。
