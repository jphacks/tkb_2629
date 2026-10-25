# TKB 2629 frontend

Expo + React Native + TypeScript で構成したアプリのひな型です。

Node.js 22.13 以上（推奨: 24 LTS）が必要です。

## 起動

```bash
npm install
npm start
```

バックエンドの URL は `.env` の `EXPO_PUBLIC_API_URL` で変更できます。Android エミュレーターからホスト PC の API に接続する場合は、通常 `http://10.0.2.2:8000` を指定してください。

## 構成

- `App.tsx`: 画面のエントリーポイント
- `src/lib/api.ts`: API クライアント
- `src/types/user.ts`: ユーザー型

「本棚」から「本を追加する」を開くと、Google Booksのタイトル検索結果を表示します。
候補をタップするとGoogle BooksのIDをバックエンドで再取得し、共有書誌を本棚へ追加します。
バックエンドでは開発用認証設定とGoogle Books用のDBマイグレーションを適用してください。

### API接続の確認

Expo Goを実機で利用する場合、`localhost` はスマートフォン自身を指します。
`frontend/.env` の `EXPO_PUBLIC_API_URL` に、PCのLANアドレスとbackendのポート
（例: `http://192.168.1.10:8000`）を指定し、Expoを再起動してください。
Expoの配信ポートとbackendのポートは別です。

開発時はAPIレスポンスのURL・HTTPステータス・Content-Typeを `[API]` ログに出します。
レスポンス本文はログに出しません。JSON以外の応答や壊れたJSONは、
接続先情報を含むエラーとして表示します。

## 画面遷移

画面遷移は `src/screens/types.ts` の `Navigate` 型を共有します。
本の詳細・編集へは `{ name: 'book-detail', bookId }` のように対象の本のIDを渡します。
本棚で選択したIDは、詳細→編集→詳細の遷移でも保持します。
それ以外の画面は従来どおり画面名の文字列でも遷移できます。

本の詳細は `GET /books/{bookId}` から書名・著者・読書進捗を取得します。
取得中は読み込み表示、失敗時はエラーと再試行ボタンを表示します。
本棚と同様に、詳細の取得にはバックエンドの認証設定が必要です。

詳細内のしおり一覧・感情分析はサンプル表示であることを明記しています。
編集画面もまだサンプルで、保存処理としおりへの本ID・読書回の引き継ぎは未対応です。
