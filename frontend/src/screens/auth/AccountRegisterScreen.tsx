import { AuthForm } from './AuthForm';
import { authPost } from '../../lib/auth';
import type { Navigate } from '../types';
export function AccountRegisterScreen({ onNavigate }: { onNavigate: Navigate }) {
  return <AuthForm title="アカウント登録" description="パスワードは12〜128文字で設定してください。登録後にメール確認が必要です。"
    fields={[{ key: 'name', label: 'ユーザー名' }, { key: 'email', label: 'メールアドレス', email: true },
      { key: 'password', label: 'パスワード', password: true }, { key: 'confirmation', label: 'パスワード（確認）', password: true }]}
    submitLabel="確認メールを送信" submit={async values => {
      if (values.password !== values.confirmation) throw new Error('パスワードが一致しません');
      if (values.password.length < 12 || values.password.length > 128) throw new Error('パスワードは12〜128文字で入力してください');
      await authPost('register', { name: values.name, email: values.email.trim(), password: values.password });
      onNavigate('verify-email');
    }} links={[{ label: 'ログインへ', onPress: () => onNavigate('login') },
      { label: 'メール確認・送信失敗時の再送', onPress: () => onNavigate('verify-email') }]} />;
}
