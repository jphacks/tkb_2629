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

## 画面遷移

画面遷移は `src/screens/types.ts` の `Navigate` 型を共有します。
本の詳細・編集へは `{ name: 'book-detail', bookId }` のように対象の本のIDを渡します。
本棚で選択したIDは、詳細→編集→詳細の遷移でも保持します。
それ以外の画面は従来どおり画面名の文字列でも遷移できます。

このIDの引き継ぎは、詳細のAPI取得や編集の保存処理とは別です。
詳細・編集の表示はまだサンプルで、しおりへの本ID・読書回の引き継ぎも未対応です。
