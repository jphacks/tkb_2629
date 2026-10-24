import { AddBookScreen } from '../books/AddBookScreen';
import type { ScreenKey } from '../types';

export function SearchScreen({ onNavigate }: { onNavigate: (route: ScreenKey) => void }) {
  return (
    <AddBookScreen
      activeRoute="search"
      onNavigate={onNavigate}
      title="本を探す"
      subtitle="Google Booksから読みたい本を見つけましょう"
    />
  );
}
