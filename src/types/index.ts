export type Category = 'Planet' | 'Science' | 'Community' | 'Health';
export interface Story {
  id: string; version: number; title: string; summary: string | null; category: Category;
  location: string; lat: number | null; lng: number | null;
  locationPrecision: 'city' | 'region' | 'country' | 'unknown';
  publishedAt: string; fetchedAt: string; eventDate: string | null;
  datePrecision: 'day' | 'month' | 'year' | null;
  sourceName: string | null; sourceUrl: string | null;
  image: string | null; imageAlt: string; imageCredit: string | null;
  isDemo: boolean; archive: boolean;
}
export const CATEGORY_COLORS = { All: '#FFE438', Planet: '#4AE18B', Science: '#29D6DA', Community: '#42ACFF', Health: '#A1E6AF' };
export type CategoryFilter = 'All' | Category;
export interface Filters { category: CategoryFilter; query: string; period: '7' | '30' | 'all'; savedOnly: boolean }
export interface Feed { stories: Story[]; revision: string; updatedAt: string | null; checkedAt: string }
