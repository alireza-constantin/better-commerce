import Link from 'next/link';
import { getStorefrontServer } from '../../lib/storefront';
export const dynamic = 'force-dynamic';
export default async function CollectionsPage() { const page = await getStorefrontServer().listCollections(); return <main className="collections-page"><header className="page-heading"><h1>مجموعه‌ها</h1><p>انتخاب‌های آماده و چیدمان‌شده فروشگاه را ببینید.</p></header>{page.items.length ? <ul className="collection-list">{page.items.map((collection) => <li key={collection.id}><Link href={`/collections/${collection.slug}`}><h2>{collection.title}</h2><p>{collection.summary ?? 'مشاهده کالاهای این مجموعه'}</p></Link></li>)}</ul> : <p className="empty-state">هنوز مجموعه‌ای برای نمایش وجود ندارد.</p>}</main>; }
