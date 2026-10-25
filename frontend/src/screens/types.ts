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
  | 'book-edit'
  | 'add-book'
  | 'account-settings'
  | 'public-profile'
  | 'public-reviews'
  | 'reading-complete'
  | 'bookmark';

export type Route =
  | { name: Exclude<ScreenKey, 'book-detail' | 'book-edit' | 'bookmark' | 'public-reviews'> }
  | { name: 'book-detail' | 'book-edit' | 'public-reviews'; bookId: number }
  | { name: 'bookmark'; bookId?: never; iteration?: never; page?: never }
  | { name: 'bookmark'; bookId: number; iteration: number; page?: number };

export type NavigationTarget =
  | Exclude<ScreenKey, 'book-detail' | 'book-edit' | 'public-reviews'>
  | Route;

export type Navigate = (route: NavigationTarget) => void;
