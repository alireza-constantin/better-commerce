import Link from 'next/link';
import { getStorefrontServer } from '../lib/storefront';

/** Server-rendered navigation; the renderer owns its cache policy. */
export async function CategoryNavigation() {
  const navigation = await getStorefrontServer().listCategoryNavigation();
  if (!navigation.items.length) return null;
  return <nav className="category-navigation" aria-label="دسته‌بندی کالاها"><ul>{navigation.items.map((item) => <li key={item.id}><Link href={`/categories/${item.slug}`}>{item.title}</Link></li>)}</ul></nav>;
}
