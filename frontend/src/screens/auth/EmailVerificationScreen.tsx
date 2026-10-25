import { useState } from 'react';
import { AuthForm } from './AuthForm';
import { authPost } from '../../lib/auth';
import type { Navigate } from '../types';
export function EmailVerificationScreen({ onNavigate }: { onNavigate: Navigate }) {
  const [resend, setResend] = useState(false);
  return <AuthForm key={String(resend)} title={resend ? '確認メールを再送信' : 'メールアドレスを確認'}
    description="メールに記載された確認トークンを貼り付けてください。有効期限は30分です。"
    fields={resend ? [{ key: 'email', label: '登録したメールアドレス', email: true }] : [{ key: 'token', label: '確認トークン' }]}
    submitLabel={resend ? '再送信' : 'メールを確認'} submit={async values => {
      if (resend) return (await authPost('resend-verification', { email: values.email.trim() })).message;
      await authPost('verify-email', { token: values.token.trim() }); onNavigate('register-complete');
    }} links={[{ label: resend ? '確認トークンを入力' : 'メールが届かない・再送する', onPress: () => setResend(!resend) },
      { label: 'ログインへ', onPress: () => onNavigate('login') }]} />;
}
