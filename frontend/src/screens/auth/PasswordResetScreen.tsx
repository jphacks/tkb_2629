import { useState } from 'react';
import { AuthForm } from './AuthForm';
import { authPost, clearLocalSession } from '../../lib/auth';
import type { Navigate } from '../types';
export function PasswordResetScreen({ onNavigate, onBack, accountLayout = false }: { onNavigate: Navigate; onBack?: () => void; accountLayout?: boolean }) {
  const [sent, setSent] = useState(false);
  const back = onBack ?? (() => onNavigate(accountLayout ? 'account-settings' : 'login'));
  return <AuthForm key={String(sent)} title={accountLayout ? 'パスワードの変更' : 'パスワードの再設定'}
    accountLayout={accountLayout} onBack={back} onNavigate={onNavigate}
    description={sent ? 'メールの確認トークンと、新しいパスワード（12〜128文字）を入力してください。' : '登録メールアドレスへ再設定用の確認トークンを送ります。'}
    fields={sent ? [{ key: 'token', label: '確認トークン' }, { key: 'password', label: '新しいパスワード', password: true },
      { key: 'confirmation', label: 'パスワード（確認）', password: true }] : [{ key: 'email', label: 'メールアドレス', email: true }]}
    submitLabel={sent ? 'パスワードを更新' : '再設定メールを送信'} submit={async values => {
      if (!sent) {
        await authPost('forgot-password', { email: values.email.trim() }); setSent(true); return;
      }
      if (values.password !== values.confirmation) throw new Error('パスワードが一致しません');
      await authPost('reset-password', { token: values.token.trim(), password: values.password });
      await clearLocalSession();
      return 'パスワードを更新しました。ログイン画面へ戻り、新しいパスワードでログインしてください。';
    }} links={[...(!accountLayout ? [{ label: '前の画面に戻る', onPress: back }] : []),
      { label: sent ? '再設定メールを再送' : '確認トークンを持っている', onPress: () => setSent(!sent) },
      ...(!accountLayout ? [{ label: 'ログインへ', onPress: () => onNavigate('login') }] : [])]} />;
}
