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
  | { name: Exclude<ScreenKey, 'book-detail' | 'book-edit'> }
  | { name: 'book-detail' | 'book-edit'; bookId: number };

export type NavigationTarget =
  | Exclude<ScreenKey, 'book-detail' | 'book-edit'>
  | Route;

export type Navigate = (route: NavigationTarget) => void;
