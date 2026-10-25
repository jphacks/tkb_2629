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
import { BookmarkBookSelectScreen } from './src/screens/main/BookmarkBookSelectScreen';
import { ReadingScreen } from './src/screens/main/ReadingScreen';
import { SearchScreen } from './src/screens/main/SearchScreen';
import { AccountScreen } from './src/screens/main/AccountScreen';
import { ReadingCompleteScreen } from './src/screens/reading/ReadingCompleteScreen';
import type { ScreenKey } from './src/screens/types';

export default function App() {
  const [screen, setScreen] = useState<ScreenKey>('register');

  switch (screen) {
    case 'register': return <AccountRegisterScreen onNavigate={setScreen} />;
    case 'login': return <LoginScreen onNavigate={setScreen} />;
    case 'verify-email': return <EmailVerificationScreen onNavigate={setScreen} />;
    case 'register-complete': return <AccountRegisterCompleteScreen onNavigate={setScreen} />;
    case 'home': return <HomeScreen onNavigate={setScreen} />;
    case 'bookshelf': return <BookshelfScreen onNavigate={setScreen} />;
    case 'reading': return <ReadingScreen onNavigate={setScreen} />;
    case 'search': return <SearchScreen onNavigate={setScreen} />;
    case 'account': return <AccountScreen onNavigate={setScreen} />;
    case 'book-detail': return <BookDetailScreen onNavigate={setScreen} />;
    case 'book-edit': return <BookEditScreen onNavigate={setScreen} />;
    case 'add-book': return <AddBookScreen onNavigate={setScreen} />;
    case 'account-settings': return <AccountSettingsScreen onNavigate={setScreen} />;
    case 'reading-complete': return <ReadingCompleteScreen onNavigate={setScreen} />;
    case 'bookmark': return <BookmarkScreen onNavigate={setScreen} />;
    case 'bookmark-book-select': return <BookmarkBookSelectScreen onNavigate={setScreen} />;
  }
}
