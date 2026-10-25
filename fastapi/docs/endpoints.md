# 現在のエンドポイントと内部処理

実装元は `src/backend/presentation/routes.py`。書籍情報の外部取得は `/fetch` に集約し、本棚の登録・参照はDBだけで処理します。感想保存時のJev分析は対象外です。

## 共通の処理

- presentationが入力を検証し、applicationのServiceを呼び、infrastructureのRepositoryがDBを操作します。
- DBセッションはリクエスト単位で作成・終了し、書き込みのcommitはRepositoryが行います。
- `DATABASE_URL` 未設定のDB利用APIは503を返します。スキーマは事前に `uv run alembic upgrade head` で適用します。
- 業務例外は、対象なし404、DB制約・登録内容の競合409、入力不正422へ変換します。
- `/books` 配下は `request.state.user_id` に認証済みユーザーIDが必要です。認証ミドルウェア・ログインAPIは未実装です。未設定は401です。DB依存の解決が先に失敗すると503になる場合があります。
- `/users` 配下には現在、認証・操作権限のチェックがありません。

## ユーザー

| メソッド・パス | 内部処理 | 正常レスポンス |
| --- | --- | --- |
| `POST /users` | name・emailの長さを検証し、usersへ追加・commit・再取得。email重複は409。 | 200、id・name・email |
| `GET /users` | usersを全件取得。ページング・明示的な並び順指定はありません。 | 200、ユーザー配列 |
| `GET /users/{user_id}` | 主キーでユーザー取得。存在しなければ404。 | 200、ユーザー情報 |
| `PUT /users/{user_id}` | name・emailの両方が必要。長さ検証後、対象を取得し両方を更新・commit。対象なし404、email重複409。 | 200、更新後のユーザー情報 |
| `DELETE /users/{user_id}` | 対象ユーザーを取得し削除・commit。DBの外部キーCASCADEにより本棚・感想・解析履歴も削除。共有のbooks本体は残ります。対象なし404。 | 204、本文なし |

nameは100文字以内、emailは255文字以内です。メール形式の検証、空文字の禁止、前後の空白除去は現在行っていません。
CASCADEの説明は外部キーが有効なDB（標準構成のPostgreSQL）を前提とします。

## 本棚

| メソッド・パス | 内部処理 | 正常レスポンス |
| --- | --- | --- |
| `POST /books` | title・authorをtrimして検証。book_id未指定ならbooksを新規作成。指定時は既存booksを取得し、title・author・total_pagesの一致を確認。その後user_booksで現在のユーザーと紐付け・commit。 | 201、書籍情報 |
| `GET /books` | booksと各書籍の最新のuser_booksをJOINし、現在のユーザーの書籍だけをID昇順で取得。limitは既定50、1〜100。offsetは既定0、0以上。 | 200、items・limit・offset |
| `GET /books/{book_id}` | 現在のユーザーの本棚に存在する書籍と最新の読書回を取得。他人だけが所有する本や存在しない本は404。 | 200、書籍情報 |
| `GET /books/{book_id}/iterations` | 指定書籍の読書回を古い順に取得。 | 200、読書回の配列 |
| `POST /books/{book_id}/iterations` | 最新回が読了済みの場合だけ、回数を1増やした新しい読書回を開始。 | 201、新しい読書回 |
| `POST /books/{book_id}/iterations/{iteration_number}/complete` | 読書中の指定回を読了にし、current_pageを総ページ数へ更新。 | 200、更新後の読書回 |
| `GET /books/{book_id}/page-popularity` | 各ユーザーの最新の読書回だけを対象に、感想のあるページごとのユーザー数を集計。 | 200、page_number・user_countの配列 |

書籍情報にはid・title・author・total_pages・created_atに加え、latest_iteration・reading_status・current_page・started_at・completed_atを含みます。
titleはtrim後1〜255文字、authorは省略可・trim後255文字以内、total_pagesは1〜1,000,000です。
既存書籍の内容不一致や同じ本棚への重複登録は409、指定された既存書籍がなければ404です。
同じ本を再読するには現在の回を先に読了する必要があります。同一ユーザー・書籍で読書中にできる回は1つだけです。
書籍の更新・削除APIはありません。

## ページごとの感想

| メソッド・パス | 内部処理 | 正常レスポンス |
| --- | --- | --- |
| `GET /books/{book_id}/pages/{page_number}/review` | 本棚の所有確認→ページ範囲検証→感想取得。`iteration`未指定時は最新回。解析がcompletedなら現在のrevisionに一致する解析履歴から色を取得。 | 200、感想情報 |
| `GET /books/{book_id}/reviews` | 本棚の所有確認→指定読書回の感想をページ番号昇順に取得。`iteration`未指定は最新回。`limit`は1〜100（既定100）、`offset`は0以上（既定0）。 | 200、感想情報の配列 |
| `PUT /books/{book_id}/pages/{page_number}/review` | 所有確認→ページ・本文検証→本文を先に保存→同期解析→結果保存→最新の感想を再取得。`iteration`未指定時は最新回。 | 新規201、更新200、感想情報 |

page_numberは1以上かつ本のtotal_pages以下。本文は前後の空白を除去して1〜140文字です。
`iteration` クエリは1以上です。読了済みの回は参照できますが、感想の追加・更新は409です。
本棚または取得対象の感想が存在しなければ404、ページ範囲・本文が不正なら422です。
感想情報はid・book_id・page_number・review_text・color_code・created_at・updated_at・iteration_number・analysis_status・sourceです。
analysis_statusはpending・completed・failedです。sourceは現在のrevisionの解析がある場合のみ
jev（実AI）・mock（仮結果）などを返し、それ以外はnullです。色が同じでも解析失敗とは限りません。
同じ感想や同様の感情は同じ色になることがあります。

PUTの詳細:

1. 新規ならrevision=1、更新ならrevisionを加算し、analysis_status=pendingで本文をcommitします。
2. 同じページへの新規保存が競合した場合は、既存行を取得して更新に切り替えます。
3. `TYPESAFE_API_KEY` 設定時はJev APIへ8感情の強さを問い合わせ、0〜1へ正規化します。
4. domainで投影座標・coherence・intensity・色を計算し、EmotionResultを返します。キー未設定時は全感情0のモックで色は `#8C8C8C` です。
5. 保存時のrevisionが現在のrevisionと一致した場合だけ、状態をcompletedにし、解析情報をemotion_analysesへ保存・commitします。古い解析結果は破棄します。
6. 解析または結果保存が失敗した場合はログを出し、対象revisionをfailedにします。先に保存した本文は保持します。失敗状態の記録自体にDB障害が起きた場合まで成功が保証されるわけではありません。
7. 最新の感想を取得して返します。同時更新がある場合、別リクエストが更新した最新本文を返す場合があります。

解析履歴には色・信頼度・モデル版・source・パレット版・8感情・投影結果を保存します。現在の解析ではvalence/arousalはNULLです。
解析未完了・失敗・対応する履歴なしの場合、取得する色は `#808080` です。
感情ベクトル・履歴はAPIレスポンスに含みません。解析状態とsourceは公開します。

## 書籍検索とGoogle Books登録

- `GET /fetch?query={title}&limit=10`: Google Booksでタイトル検索します。ページ数を取得できる候補を最大20件返します。
- `POST /books/import`: `google_books_id` を受け取り、Google Booksから書誌を再取得して現在のユーザーの本棚へ追加します。

検索結果はGoogle Books ID・タイトル・著者・ページ数・ISBN-13・表紙URLです。
これらの書誌情報はレスポンス中だけで使用し、DBにはGoogle Books IDだけを保存します。
`books.google_books_id` は一意で、同じ検索候補が別表記で検索されても既存の共有書誌を
再利用します。本棚表示やページ範囲検証ではGoogle Books IDから情報を再取得します。
同じユーザーが同じ書誌を再度追加した場合は409です。
検索は認証・DB接続を必要としません。登録には読書APIと同じ認証が必要です。
キャッシュ許可期間を示すレスポンスヘッダーがないため、現在はサーバーキャッシュを
行わず、必要な都度Google Books APIへ問い合わせます。

- `GET /docs`: FastAPIのSwagger UI。
- `GET /redoc`: ReDocのAPIドキュメント。
- `GET /openapi.json`: API定義。自動生成ルートはいずれも現在無効化していません。

## 今回修正したバグ

- ユーザー作成・更新でDBカラム上限を超える文字列がPostgreSQLのエラーになるため、presentationとdomainに上限検証を追加しました。HTTP経由では422になります。
- 新規書籍のflushがcommit用の例外変換の外にあったため、その時点のIntegrityErrorをrollbackし409へ変換するよう修正しました。
