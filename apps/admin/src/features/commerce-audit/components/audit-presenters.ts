const actionLabels: Record<string, string> = {
  'pricing.price_changed': 'تغییر قیمت',
  'inventory.configured': 'تنظیم موجودی',
  'inventory.adjusted': 'اصلاح موجودی',
  'shipping.zone_created': 'ایجاد محدوده ارسال',
  'shipping.zone_updated': 'ویرایش محدوده ارسال',
  'shipping.zone_archived': 'بایگانی محدوده ارسال',
  'shipping.method_created': 'ایجاد روش ارسال',
  'shipping.method_updated': 'ویرایش روش ارسال',
  'shipping.method_archived': 'بایگانی روش ارسال',
  'shipping.rule_created': 'ایجاد نرخ ارسال',
  'shipping.rule_updated': 'ویرایش نرخ ارسال',
  'shipping.rule_archived': 'بایگانی نرخ ارسال',
  'orders.submitted': 'ثبت سفارش',
  'orders.accepted': 'پذیرش سفارش',
  'orders.rejected': 'رد سفارش',
  'payments.confirmed': 'تأیید پرداخت',
  'catalog.category_created': 'ایجاد دسته‌بندی',
  'catalog.category_updated': 'ویرایش دسته‌بندی',
  'catalog.category_moved': 'جابجایی دسته‌بندی',
  'catalog.category_archived': 'بایگانی دسته‌بندی',
  'catalog.category_restored': 'بازیابی دسته‌بندی',
  'catalog.product_categories_replaced': 'تغییر دسته‌بندی‌های کالا',
  'catalog.variant_configuration_replaced': 'تغییر گونه‌های کالا',
  'catalog.collection_created': 'ایجاد مجموعه',
  'catalog.collection_updated': 'ویرایش مجموعه',
  'catalog.collection_archived': 'بایگانی مجموعه',
  'catalog.collection_restored': 'بازیابی مجموعه',
  'catalog.collection_products_replaced': 'تغییر کالاهای مجموعه',
  'staff.created': 'افزودن کارمند',
  'staff.activated': 'فعال‌سازی کارمند',
  'staff.suspended': 'تعلیق کارمند',
  'staff.roles_replaced': 'تغییر نقش‌های کارمند',
  'owner.bootstrapped': 'راه‌اندازی مالک فروشگاه',
  'owner.assigned': 'تعیین مالک',
  'owner.removed': 'حذف نقش مالک',
};

const targetLabels: Record<string, string> = {
  product: 'کالا', variant: 'گونه کالا', category: 'دسته‌بندی', collection: 'مجموعه',
  order: 'سفارش', payment: 'پرداخت', inventory: 'موجودی', shipping_zone: 'محدوده ارسال',
  shipping_method: 'روش ارسال', shipping_rule: 'نرخ ارسال', staff: 'کارمند', staff_user: 'کارمند', user: 'کاربر',
};

export function auditActionLabel(action: string) { return actionLabels[action] ?? 'رویداد سیستمی'; }
export function auditTargetLabel(targetType: string) { return targetLabels[targetType] ?? 'بخش فروشگاه'; }
export const authorizationActionOptions = Object.entries(actionLabels).filter(([key]) => key.startsWith('staff.') || key.startsWith('owner.')).map(([value, label]) => ({ value, label }));
