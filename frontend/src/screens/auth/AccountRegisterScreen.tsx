import { AuthForm } from './AuthForm';
import { authPost } from '../../lib/auth';
import type { Navigate } from '../types';
export function AccountRegisterScreen({ onNavigate }: { onNavigate: Navigate }) {
  return <AuthForm title="アカウント登録" description="名前はアカウントと公開した感想に使い、他の読者にも表示されます\n本名でなくても構いません\nパスワードは12〜128文字で設定してください\n登録後にメール確認が必要です"
    fields={[{ key: 'name', label: '名前（他の読者にも表示）' }, { key: 'email', label: 'メールアドレス', email: true },
      { key: 'password', label: 'パスワード', password: true }, { key: 'confirmation', label: 'パスワード（確認）', password: true }]}
    submitLabel="確認メールを送信" submit={async values => {
      if (values.password !== values.confirmation) throw new Error('パスワードが一致しません');
      if (values.password.length < 12 || values.password.length > 128) throw new Error('パスワードは12〜128文字で入力してください');
      const name = values.name.trim();
      if (Array.from(name).length < 1 || Array.from(name).length > 100) throw new Error('名前は1〜100文字で入力してください');
      await authPost('register', { name, name_is_public: true, email: values.email.trim(), password: values.password });
      onNavigate('verify-email');
    }} links={[{ label: 'ログインへ', onPress: () => onNavigate('login') },
      { label: 'メール確認・送信失敗時の再送', onPress: () => onNavigate('verify-email') }]} />;
}
