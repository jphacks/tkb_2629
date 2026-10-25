import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { currentUser, restoreSession, subscribeAuth } from './src/lib/auth';
import { PasswordResetScreen } from './src/screens/auth/PasswordResetScreen';

import { BookmarkScreen } from './src/components/templates/BookmarkScreen';
import { AccountRegisterCompleteScreen } from './src/screens/auth/AccountRegisterCompleteScreen';
import { AccountRegisterScreen } from './src/screens/auth/AccountRegisterScreen';
import { EmailVerificationScreen } from './src/screens/auth/EmailVerificationScreen';
import { LoginScreen } from './src/screens/auth/LoginScreen';
import { AccountSettingsScreen } from './src/screens/account/AccountSettingsScreen';
import { PublicProfileScreen } from './src/screens/account/PublicProfileScreen';
import { AddBookScreen } from './src/screens/books/AddBookScreen';
import { BookDetailScreen } from './src/screens/books/BookDetailScreen';
import { PublicReviewsScreen } from './src/screens/books/PublicReviewsScreen';
import { BookEditScreen } from './src/screens/books/BookEditScreen';
import { BookshelfScreen } from './src/screens/main/BookshelfScreen';
import { HomeScreen } from './src/screens/main/HomeScreen';
import { ReadingScreen } from './src/screens/main/ReadingScreen';
import { SearchScreen } from './src/screens/main/SearchScreen';
import { AccountScreen } from './src/screens/main/AccountScreen';
import { ReadingCompleteScreen } from './src/screens/reading/ReadingCompleteScreen';
import type { Navigate, Route } from './src/screens/types';

export default function App() {
  const [routes, setRoutes] = useState<Route[]>([{ name: 'login' }]);
  const route = routes[routes.length - 1]!;
  const [user, setUser] = useState(currentUser());
  const [loading, setLoading] = useState(true);
  const publicRoutes = ['login', 'register', 'verify-email', 'register-complete', 'forgot-password'];
  useEffect(() => {
    const unsubscribe = subscribeAuth(() => {
      const next = currentUser();
      setUser(next);
      if (!next) {
        setRoutes([{ name: 'login' }]);
      } else {
        setRoutes((current) => {
          const active = current[current.length - 1]!;
          return ['login', 'register', 'verify-email', 'register-complete'].includes(active.name)
            ? [{ name: 'home' }] : current;
        });
      }
    });
    void restoreSession().finally(() => setLoading(false));
    return unsubscribe;
  }, []);
  const navigate: Navigate = (target) => {
    const next: Route = typeof target !== 'string'
      ? target
      : target === 'bookmark' ? { name: 'bookmark' } : { name: target };
    if (!currentUser() && !publicRoutes.includes(next.name)) {
      setRoutes([{ name: 'login' }]);
      return;
    }
    if (currentUser() && publicRoutes.includes(next.name) && next.name !== 'forgot-password') {
      setRoutes([{ name: 'home' }]);
      return;
    }
    const isMainTab = ['home', 'bookshelf', 'reading', 'search', 'account'].includes(next.name);
    setRoutes((current) => isMainTab || next.name === 'login' ? [next] : [...current, next]);
  };
  const goBack = () => setRoutes((current) => current.length > 1 ? current.slice(0, -1) : current);
  const onBack = routes.length > 1 ? goBack : undefined;

  if (loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator accessibilityLabel="ログイン状態を確認中" /></View>;
  if (!user && !publicRoutes.includes(route.name)) return <LoginScreen onNavigate={navigate} />;
  if (user && publicRoutes.includes(route.name) && route.name !== 'forgot-password') return <HomeScreen key={user.id} onNavigate={navigate} />;
  switch (route.name) {
    case 'forgot-password': return <PasswordResetScreen onNavigate={navigate} onBack={onBack} accountLayout={user !== null} />;
    case 'register': return <AccountRegisterScreen onNavigate={navigate} />;
    case 'login': return <LoginScreen onNavigate={navigate} />;
    case 'verify-email': return <EmailVerificationScreen onNavigate={navigate} />;
    case 'register-complete': return <AccountRegisterCompleteScreen onNavigate={navigate} />;
    case 'home': return <HomeScreen onNavigate={navigate} />;
    case 'bookshelf': return <BookshelfScreen onNavigate={navigate} />;
    case 'reading': return <ReadingScreen onNavigate={navigate} />;
    case 'search': return <SearchScreen onNavigate={navigate} />;
    case 'account': return <AccountScreen onNavigate={navigate} />;
    case 'book-detail': return <BookDetailScreen bookId={route.bookId} onNavigate={navigate} onBack={onBack} />;
    case 'public-reviews': return <PublicReviewsScreen key={route.bookId} bookId={route.bookId} onNavigate={navigate} onBack={onBack} />;
    case 'book-edit': return <BookEditScreen bookId={route.bookId} onNavigate={navigate} />;
    case 'add-book': return <AddBookScreen onNavigate={navigate} />;
    case 'account-settings': return <AccountSettingsScreen onNavigate={navigate} />;
    case 'public-profile': return <PublicProfileScreen onNavigate={navigate} onBack={onBack} />;
    case 'reading-complete': return <ReadingCompleteScreen onNavigate={navigate} />;
    case 'bookmark': return <BookmarkScreen bookId={route.bookId} iteration={route.iteration} initialPage={route.page} onNavigate={navigate} onBack={onBack} />;
  }
}
