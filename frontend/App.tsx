import { useState } from 'react';

import { BookmarkScreen } from './src/components/templates/BookmarkScreen';
import { AccountRegisterCompleteScreen } from './src/screens/auth/AccountRegisterCompleteScreen';
import { AccountRegisterScreen } from './src/screens/auth/AccountRegisterScreen';
import { EmailVerificationScreen } from './src/screens/auth/EmailVerificationScreen';
import { LoginScreen } from './src/screens/auth/LoginScreen';
import { AccountSettingsScreen } from './src/screens/account/AccountSettingsScreen';
import { AddBookScreen } from './src/screens/books/AddBookScreen';
import { BookDetailScreen } from './src/screens/books/BookDetailScreen';
import { BookEditScreen } from './src/screens/books/BookEditScreen';
import { BookshelfScreen } from './src/screens/main/BookshelfScreen';
import { HomeScreen } from './src/screens/main/HomeScreen';
import { ReadingScreen } from './src/screens/main/ReadingScreen';
import { SearchScreen } from './src/screens/main/SearchScreen';
import { AccountScreen } from './src/screens/main/AccountScreen';
import { ReadingCompleteScreen } from './src/screens/reading/ReadingCompleteScreen';
import type { Navigate, Route } from './src/screens/types';

export default function App() {
  const [routes, setRoutes] = useState<Route[]>([{ name: 'register' }]);
  const route = routes[routes.length - 1]!;
  const navigate: Navigate = (target) => {
    const next: Route = typeof target !== 'string'
      ? target
      : target === 'bookmark' ? { name: 'bookmark' } : { name: target };
    const isMainTab = ['home', 'bookshelf', 'reading', 'search', 'account'].includes(next.name);
    setRoutes((current) => isMainTab ? [next] : [...current, next]);
  };
  const goBack = () => setRoutes((current) => current.length > 1 ? current.slice(0, -1) : current);
  const onBack = routes.length > 1 ? goBack : undefined;

  switch (route.name) {
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
    case 'book-edit': return <BookEditScreen bookId={route.bookId} onNavigate={navigate} />;
    case 'add-book': return <AddBookScreen onNavigate={navigate} />;
    case 'account-settings': return <AccountSettingsScreen onNavigate={navigate} />;
    case 'reading-complete': return <ReadingCompleteScreen onNavigate={navigate} />;
    case 'bookmark': return <BookmarkScreen bookId={route.bookId} iteration={route.iteration} initialPage={route.page} onNavigate={navigate} onBack={onBack} />;
  }
}
