import { AddBookScreen } from '../books/AddBookScreen';
import type { Navigate } from '../types';

export function SearchScreen({ onNavigate }: { onNavigate: Navigate }) {
  return (
    <AddBookScreen
      activeRoute="search"
      onNavigate={onNavigate}
      title="本を探す"
      subtitle="Google Booksから読みたい本を見つけましょう"
    />
  );
}
