import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { getStorefrontServer } from '../../../lib/storefront';
import { ProductGrid } from '../../../components/product-grid';

export const dynamic = 'force-dynamic';
export default async function CategoryPage({ params }: { readonly params: Promise<{ slug: string }> }) { const { slug } = await params; const storefront = getStorefrontServer(); try { const category = await storefront.getPublicCategory(slug); if (!category.requestedSlugIsCanonical) permanentRedirect(`/categories/${category.canonicalSlug}`); const products = await storefront.listCategoryProducts(category.canonicalSlug, { limit: 24 }); return <main className="category-page"><Link className="back-link" href="/">بازگشت به فروشگاه</Link><header className="page-heading"><h1>{category.category.title}</h1>{category.category.summary ? <p>{category.category.summary}</p> : null}</header>{category.category.description ? <p className="page-description">{category.category.description}</p> : null}<ProductGrid page={products} emptyMessage="در این دسته‌بندی کالای قابل نمایشی وجود ندارد." /></main>; } catch (error) { if (error instanceof Error && 'status' in error && error.status === 404) notFound(); throw error; } }
