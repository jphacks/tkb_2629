export type ScreenKey =
  | 'register'
  | 'login'
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
  | 'reading-complete'
  | 'bookmark';

export type Route =
  | { name: Exclude<ScreenKey, 'book-detail' | 'book-edit' | 'bookmark'> }
  | { name: 'book-detail' | 'book-edit'; bookId: number }
  | { name: 'bookmark'; bookId?: never; iteration?: never }
  | { name: 'bookmark'; bookId: number; iteration: number };

export type NavigationTarget =
  | Exclude<ScreenKey, 'book-detail' | 'book-edit'>
  | Route;

export type Navigate = (route: NavigationTarget) => void;
