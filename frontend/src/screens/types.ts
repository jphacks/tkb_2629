export type ScreenKey =
  | 'register'
  | 'login'
  | 'forgot-password'
  | 'verify-email'
  | 'register-complete'
  | 'home'
  | 'bookshelf'
  | 'reading'
  | 'search'
  | 'account'
  | 'book-detail'
  | 'book-memo'
  | 'add-book'
  | 'account-settings'
  | 'public-profile'
  | 'public-reviews'
  | 'reading-complete'
  | 'bookmark';

export type Route =
  | { name: Exclude<ScreenKey, 'book-detail' | 'book-memo' | 'bookmark' | 'public-reviews'> }
  | { name: 'book-detail' | 'book-memo' | 'public-reviews'; bookId: number }
  | { name: 'bookmark'; bookId?: never; iteration?: never; page?: never }
  | { name: 'bookmark'; bookId: number; iteration: number; page?: number };

export type NavigationTarget =
  | Exclude<ScreenKey, 'book-detail' | 'book-memo' | 'public-reviews'>
  | Route;

export type Navigate = (route: NavigationTarget) => void;
