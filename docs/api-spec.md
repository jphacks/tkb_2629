# 読書API仕様

Base URLは `/api/v1` です。JSONを送受信し、時刻はUTCのISO 8601形式です。
以下の新APIは、信頼済み認証ミドルウェアが `request.state.user_id` に既存
`users.id` を設定することを前提にします。ユーザーIDをJSONやqueryで指定できません。
認証情報がなければ `401`、他ユーザーの本は存在を隠すため `404` です。

認証実装はまだありません。ミドルウェア接続前は新APIはすべて `401` を返します。既存 `/users` CRUDの認証は今回変更していません。

## 共通エラー

FastAPIの入力検証エラーは `422 Unprocessable Entity` です。

```json
{"detail": "..."}
```

DB接続設定がない場合は `503 Service Unavailable` です。DB接続自体の障害はサーバーエラーとなります。

## 本の登録・読書リストへの追加

`POST /api/v1/books`

新しい書誌と読書記録を作成します。`book_id` を指定すると既存書誌をこのユーザーの読書リストへ追加します。

リクエスト例:

```json
{
  "title": "銀河鉄道の夜",
  "author": "宮沢賢治",
  "total_pages": 180
}
```

既存の本を追加する場合:

```json
{
  "book_id": 12,
  "title": "銀河鉄道の夜",
  "author": "宮沢賢治",
  "total_pages": 180
}
```

`title` は前後空白を除いて1-255文字、`author` は任意で255文字以下、
`total_pages` は1-1,000,000の整数です。指定した `book_id` の書誌情報は
リクエストと一致する必要があります。

成功: 新規書誌・読書記録の作成は `201 Created`。

```json
{
  "id": 12,
  "title": "銀河鉄道の夜",
  "author": "宮沢賢治",
  "total_pages": 180,
  "created_at": "2026-10-24T10:00:00Z",
  "reading": {
    "user_book_id": 31,
    "current_page": 0,
    "status": "reading",
    "started_at": "2026-10-24T10:00:00Z",
    "completed_at": null
  }
}
```

主なエラー: `401` 未認証、`404` 指定書誌なし、`409` 書誌情報不一致または
読書リスト登録済み、`422` 入力不正、`503` DB URL未設定。

DB動作: 新規時は `books` と `user_books` を作成。既存 `book_id` 時は書誌を
検証し `user_books` のみ作成。ユーザーIDは認証依存から取得します。

## 本の一覧

`GET /api/v1/books?limit=50&offset=0`

認証ユーザーの読書リストだけを返します。`limit` は1-100、`offset` は0以上です。

成功: `200 OK`

```json
{
  "items": [
    {
      "id": 12,
      "title": "銀河鉄道の夜",
      "author": "宮沢賢治",
      "total_pages": 180,
      "created_at": "2026-10-24T10:00:00Z",
      "reading": {
        "user_book_id": 31,
        "current_page": 0,
        "status": "reading",
        "started_at": "2026-10-24T10:00:00Z",
        "completed_at": null
      }
    }
  ],
  "limit": 50,
  "offset": 0
}
```

主なエラー: `401` 未認証、`422` ページング値不正、`503` DB URL未設定。

DB動作: `user_books.user_id` で絞り、`books` と結合して取得します。

## 本の詳細

`GET /api/v1/books/{book_id}`

成功時 `200 OK`。レスポンスは一覧の1要素と同じです。主なエラーは `401` 未認証、
`404` 本がない/所有していない、`422` ID不正、`503` DB URL未設定です。DBは
`book_id` と認証ユーザーIDの両方で検索します。

## 読書進捗の更新

`PATCH /api/v1/books/{book_id}/progress`

リクエスト:

```json
{"current_page": 120}
```

`current_page` は0以上かつ本の総ページ数以下です。成功は `200 OK` で、本の詳細形式を
返します。最終ページでは `status=completed` と `completed_at` を設定し、それより
小さい値に戻すと `reading` に戻して完了日時を消します。主なエラーは `401`、`404`、
`422`、`503` です。DBは本人の `user_books` だけを更新します。

## ページ感想の取得

`GET /api/v1/books/{book_id}/pages/{page_number}/review`

成功は `200 OK`。

```json
{
  "id": 91,
  "book_id": 12,
  "page_number": 3,
  "review_text": "心に残る場面だった。",
  "analysis_status": "completed",
  "analysis": {
    "emotion_label": null,
    "color_code": "#FF8C1A",
    "confidence": 0.7,
    "model_version": "jev-1.13.0",
    "source": "jev",
    "valence": null,
    "arousal": null,
    "palette_version": "emotion-wheel-mix-v1",
    "emotion_vector": {
      "joy": 1.0,
      "trust": 0.0,
      "fear": 0.0,
      "surprise": 0.0,
      "sadness": 0.0,
      "disgust": 0.0,
      "anger": 1.0,
      "anticipation": 0.0
    },
    "created_at": "2026-10-24T10:01:00Z"
  },
  "created_at": "2026-10-24T10:00:00Z",
  "updated_at": "2026-10-24T10:00:00Z"
}
```

分析が未完了/失敗、または現revisionの分析がない場合 `analysis` は `null` です。
`source=mock` は仮結果であり、AI分析結果として表示しないでください。主なエラーは
`401`、`404` 感想なし/本がない/所有していない、`422` ページ番号が1未満または
総ページ数超過、`503` です。DBは本人の読書記録を経由して感想を検索します。

Jev接続時は `TYPESAFE_API_KEY` が設定されている場合にJevアダプターを選択します。
感想をstateとして1回送り、喜び・信頼・恐れ・驚き・悲しみ・嫌悪・怒り・期待の8つを
それぞれ5段階の `Score` で評価します。Score値0〜4を `score / 4` で0〜1に正規化します。
8値は `emotion_vector` に含まれます。各感情の色相を強度で重みづけして円周上で合成し、
打ち消し合う場合は彩度が下がります。`confidence` は8質問の最低値、`model_version` は
SDKレスポンスのモデル名です。モック利用時は8値すべて0、`source=mock`、グレーを返します。

## ページ感想の保存・更新

`PUT /api/v1/books/{book_id}/pages/{page_number}/review`

リクエスト:

```json
{"review_text": "心に残る場面だった。"}
```

`review_text` は前後空白を除いて1-10,000文字、ページ番号は1から総ページ数までです。
初回保存は `201 Created`、更新は `200 OK`。レスポンスは感想取得と同じ形式です。
分析失敗でも感想保存は成功し、`analysis_status=failed`、`analysis=null` を返します。
Jevの呼び出し失敗時は感想本文がDBに残ります。再試行APIは今回の対象外です。

主なエラー: `401` 未認証、`404` 本がない/所有していない、`422` 感想やページ番号不正、`503` DB URL未設定。

DB動作: `(user_book_id, page_number)` でupsertし、DB一意制約も重複を防ぎます。
本文と `pending` を先にコミットし、その後に分析します。更新時はrevisionを増やし、
古いrevisionの分析結果を現在の結果として返しません。
