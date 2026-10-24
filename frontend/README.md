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

現在は `GET /users` を使った一覧表示まで実装しています。作成・編集・削除画面はこの土台に追加できます。
