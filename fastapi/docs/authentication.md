# 認証認可コンテキスト

## 起動前の設定

認証サービスへの登録は不要です。通常の新規登録・メール確認・パスワード再設定にはPostgreSQLとSMTP送信環境を使用します。
開発時は下記のDB直接登録コマンドを使うことで、SMTP未設定でもログイン用ユーザーを用意できます。
依存関係・lockファイルは追加済みです。実行環境では以下を適用してください。
この変更ではテスト、サーバー起動、実DBへのマイグレーション、commitは実施していません。

```bash
# fastapi/ ディレクトリ
uv sync
# .env の値をプロセス環境へ読み込んでから実行する
uv run alembic upgrade head
```

Docker Composeでは `.env` をAPIコンテナへ渡します。ローカル実行では必要な環境変数をエクスポートしてください。
秘密鍵やSMTP認証情報はフロントエンドやGitへ入れないでください。

| 変数 | 設定 |
| --- | --- |
| DATABASE_URL | 既存PostgreSQLの接続先 |
| AUTH_JWT_SECRET | `openssl rand -hex 32` 等で生成したランダムな秘密鍵（32バイト以上） |
| AUTH_JWT_ISSUER | 既定値 `re-read-api` |
| APP_ENV | ローカルは `development`、本番は `production` |
| CORS_ORIGINS | フロントのOriginをカンマ区切りで指定。ワイルドカードは使わない |
| SMTP_HOST / SMTP_PORT | メールサーバー。通常587番 |
| SMTP_SECURITY | `starttls`（既定）または `ssl`（通常465番） |
| SMTP_FROM | 送信元メールアドレス |
| SMTP_USERNAME / SMTP_PASSWORD | SMTPログイン情報。認証不要の開発用サーバーでは空欄 |

ローカルSMTPのMailpit等を使う場合のみ `APP_ENV=development` と `SMTP_SECURITY=plain` を指定できます。
送信トークンをAPIレスポンスやログへ出す機能はありません。開発用メールボックスで確認してください。
SMTP未設定・送信失敗は503になります。登録が保存されたあと送信に失敗した場合も、確認画面の再送から復旧できます。
本番ではHTTPSを使用してください。Web版のCookieは開発環境以外ではSecureです。
Web版フロントとAPIは同一サイトに置き、CORS_ORIGINSにフロントの正確なOriginを登録してください。
JWT署名鍵の変更は全アクセストークンを無効にします。リフレッシュ用DBセッションは別途残ります。

## 開発用ユーザーをDBに直接作成

`APP_ENV=development` のときだけ、メールを送信せずに確認済みのユーザーを作成・更新できます。
アプリの新規登録画面を通さず、このコマンドでDBに保存した後、通常のログイン画面を使用します。
SMTP設定はすべて空欄でも構いません。ログインに使う `AUTH_JWT_SECRET` と `DATABASE_URL` は設定してください。
先に0009までのマイグレーションを適用しておく必要があります。

Docker Composeの場合、`fastapi/` ディレクトリで次を実行します。

```bash
docker compose exec api uv run python -m backend.composition.development_user \
  --email dev@example.com \
  --name 開発ユーザー
```

パスワードを対話で2回入力します（12〜128文字・入力は非表示）。
保存後、アプリのログイン画面で指定したメールアドレスとパスワードを入力してください。
すでに登録を試したメールを使いたい場合は、`--email` をそのアドレスに置き換えます。
同じメールの既存ユーザーはIDと読書記録を維持して、パスワードと確認済み状態を更新します。
`--name` を省略すると既存名を維持し、新規の場合は「開発ユーザー」になります。
更新対象ユーザーの既存セッション、メール確認・再設定トークンは失効します。

Dockerを使わない場合は、ローカルDBに接続できる `.env` を指定します。

```bash
uv run --env-file .env python -m backend.composition.development_user \
  --email dev@example.com
```

対話端末のない自動化では `--password-stdin` を付け、標準入力の1行目からパスワードを渡せます。
パスワードをコマンド引数に渡すオプションは用意していません。
`APP_ENV` 未設定・`production` 等ではパスワード入力やDB更新を行う前に拒否します。
開発用のユースケース側でも有効化状態を確認します。HTTP経由でこの処理を呼ぶエンドポイントは追加していません。

処理は認証認可コンテキストの開発用ユースケース・既存ポート・Unit of Workを使用し、
ユーザーと認証情報を同一トランザクションで保存します。メール設定やJWT発行への依存はありません。
ログイン後は従来どおり、パスワード照合・JWT・セッション・回数制限を利用します。
アプリの新規登録画面とパスワード再設定のメール処理は従来どおりSMTPを必要とします。

SQLで手動登録する場合も、`users` に加えて `auth_credentials` が必要です。
後者には同じ `user_id`、正規化したメール、Argon2idの `password_hash`、`verified=true` を保存します。
`users` に名前とメールだけを入れても、パスワード照合に必要な認証情報がないためログインできません。

## API

| メソッド・パス | 入力・動作 |
| --- | --- |
| POST /auth/register | `name`, `email`, `password`。登録と確認メール送信 |
| POST /auth/verify-email | `token`。メール確認を完了 |
| POST /auth/resend-verification | `email`。確認メール再送 |
| POST /auth/login | `email`, `password`。メール確認済みのみログイン可能 |
| POST /auth/refresh | ネイティブは `refresh_token`、Webは `{}` とCookie。トークンをローテーション |
| POST /auth/logout | 同上。対象のセッション系列を失効しCookieを削除 |
| GET /auth/me | Bearer JWTで本人の `id`, `name`, `email` を取得 |
| POST /auth/forgot-password | `email`。再設定メール送信 |
| POST /auth/reset-password | `token`, `password`。更新と全セッション失効 |

ログイン・更新は `access_token`, `refresh_token`, `token_type`, `expires_in`, `user` を返します。
アクセストークンは15分、ログイン継続はログイン時点から最大30日です。更新しても30日の期限は延長しません。
WebではリフレッシュトークンをlocalStorageへ保存せず、HttpOnly Cookieを使います。
メールには32バイトの乱数から生成した確認トークンを記載します。有効期限は30分で、一度使うと同じ用途の全トークンが失効します。
パスワードは12〜128文字で、Argon2id（64 MiB、3反復、並列度1）を使用します。
リフレッシュ・メール確認・再設定トークンはSHA-256ハッシュのみDBへ保存します。
更新前のリフレッシュトークンの再使用は、そのセッション系列全体を失効します。
ログアウトとパスワード再設定後は、JWTの期限が残っていてもサーバー側のセッション照合で拒否します。

IP単位で登録・ログイン・ログアウト・確認・メール送信・再設定を各30回/15分、メールアドレス単位で登録・ログイン・メール送信各5回/15分に制限します。
更新はIP単位300回/15分です。PostgreSQLのatomic upsertで複数プロセス間でも共有します。
窓は固定の15分単位です。上限時は429とRetry-Afterを返します。
IPはASGIのrequest.clientから取得します。リバースプロキシ利用時は信頼するプロキシのみが
クライアントIPを復元できるようASGIサーバーを設定してください。クライアント入力のForwardedヘッダーは直接参照しません。
メール再送・再設定要求は、対象アカウントの有無にかかわらず同じ成功メッセージを返します。
期限切れの確認トークン・セッションはドメインの有効期限ルールで拒否します。回数制限レコードは関連操作時に削除します。
確認トークンとセッションの期限切れレコードを物理削除する定期処理は未実装です。

## 境界と既存データ

- `identity/domain`: `Identity` / `LoginSession` / `VerificationChallenge`、メール・名前の値オブジェクト、期限・回数制限・本人操作とメール変更制限のポリシー、業務例外。標準ライブラリ以外に依存しません。
- `identity/application`: 登録・ログイン・更新・失効・確認・再設定のユースケース、Unit of Workと外部依存のポート、HTTPから独立した結果DTO。domainと同層以外に依存しません。
- `identity/infrastructure`: 専用ORM、リポジトリ、Unit of Work、Argon2id、JWT、SMTP。ドメインへの変換とI/Oを担当し、期限・更新可否・再使用への対応は判定しません。
- `identity/presentation`: `/auth`、入力スキーマ、Cookie・Origin制御、業務例外からHTTPステータスへの変換。具体的なインフラの組み立てはしません。
- `identity/public.py`: 他コンテキストとの接続に公開する認証・認可インターフェース、結果DTO、失敗の型。
- `composition/identity.py`: 環境変数の読み込み、具体アダプターの組み立て、FastAPIの依存注入を設定するcomposition root。
- `integration/identity.py`: 公開された認証結果を、共通HTTP認証ポートへ変換します。
- `shared/application/security.py` / `shared/presentation/auth.py`: 認証実装に依存しないHTTP認証ポートと接続。
- `shared/database.py` / `shared/persistence.py`: DB接続・共通メタデータと、業務ルールを含まないSQL Unit of Workの技術的な管理。

依存方向は `presentation → application → domain`、`infrastructure → application/domain` です。
コンテキスト間の具体的な接続はcomposition rootとintegrationに閉じ込めています。
ユーザープロフィールと認証情報は、ともに認証認可コンテキストが所有します。
登録時は同じUnit of Workでユーザーと認証情報を原子的に保存します。
既存のメールを持つユーザーへ認証情報を自動追加することはありません。
全体の所有と依存規則は [コンテキスト設計](contexts.md) を参照してください。

ユースケースがトランザクションとcommitを制御し、リポジトリはcommitしません。
ログイン・更新・確認トークン消費・ログアウトは認証情報を最初にロックし、競合する処理を直列化します。
更新前トークンの再使用時はセッション系列の失効をcommitしてから拒否します。
回数制限は独立した短いトランザクションで記録するため、ログイン失敗のrollbackで回数が巻き戻りません。
メールはDB保存後に送信し、SMTP処理中にDBロックを保持しません。
HTTPステータスとリトライ用ヘッダーはpresentationのみが決定します。

既存の `users` を参照し、認証情報・セッション・確認トークン・回数制限は専用テーブルに保持します。
マイグレーション0009は既存ユーザーへ認証情報を自動付与しません。既存メールへの新規登録で
旧アカウントを乗っ取れるような自動紐付けも行いません。旧ユーザーを継続利用したい場合は、
別途本人確認を伴う移行が必要です。

未認証の `POST /users` と開発用の固定user_idバイパスは廃止しました。
`GET /users` は本人1件のみを返し、個別参照・更新・削除も本人だけに制限します。
本人操作とメール変更制限は認証認可ドメインの `UserAccessPolicy` が判定し、
`/users` のHTTP APIとProfileServiceも認証認可コンテキストが管理します。
旧ユーザー更新APIによるメール変更は禁止し、メール確認を迂回できないようにしています。
名前は従来のユーザー更新APIで変更できます。プロフィール表示はログイン・更新時に取得したスナップショットです。
読書・書籍・感情分析の業務ルールは変更していません。

既存テストは変更・実行していません。認証の回数制限とロックは実運用先のPostgreSQLを対象としています。

## コード・依存確認

4コンテキスト全体の静的確認・型チェック・import・スキーマ確認は [コンテキスト設計](contexts.md) に記載しています。
DB・SMTP・Jevへの接続、実DBマイグレーション、動作テストは実施していません。

## 参考

[OWASP: Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
[OWASP: Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
