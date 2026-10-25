import { AuthForm } from './AuthForm';
import { login } from '../../lib/auth';
import type { Navigate } from '../types';
export function LoginScreen({ onNavigate }: { onNavigate: Navigate }) {
  return <AuthForm title="おかえりなさい" description="メール確認済みのアカウントでログインしてください"
    fields={[{ key: 'email', label: 'メールアドレス', email: true }, { key: 'password', label: 'パスワード', password: true }]}
    submitLabel="ログイン" submit={async values => { await login(values.email, values.password); onNavigate('home'); }}
    links={[{ label: '新規登録', onPress: () => onNavigate('register') },
      { label: 'パスワードを忘れた方', onPress: () => onNavigate('forgot-password') },
      { label: 'メール確認・確認メールの再送', onPress: () => onNavigate('verify-email') }]} />;
}
