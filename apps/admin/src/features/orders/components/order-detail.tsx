import { AlertTriangle, Check, ClipboardCheck, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
  formatExactMoney,
  formatOrderDate,
  fulfillmentLabel,
  orderStatusLabel,
  paymentMethodLabel,
  paymentStatusLabel,
  type AdminOrder,
} from './order-presenters';
import { OrderStatusBadge, PaymentStatusBadge } from './orders-list';

export interface OrderActionHandlers {
  readonly onAccept?: (input: { readonly note?: string }) => void | Promise<void>;
  readonly onReject?: (input: { readonly note?: string }) => void | Promise<void>;
  readonly onConfirmPayment?: (input: {
    readonly note?: string;
    readonly reference?: string;
  }) => void | Promise<void>;
}

export interface OrderActionAvailability {
  readonly canAccept?: boolean;
  readonly canReject?: boolean;
  readonly canConfirmPayment?: boolean;
  readonly isSubmitting?: boolean;
}

export interface OrderDetailProps {
  readonly order: AdminOrder;
  readonly actions?: OrderActionHandlers;
  readonly availability?: OrderActionAvailability;
  readonly onBack?: () => void;
}

export function OrderDetail({
  actions,
  availability,
  onBack,
  order,
}: OrderDetailProps) {
  return (
    <article className="mx-auto max-w-6xl space-y-6" dir="rtl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {onBack ? <Button className="mb-4" onClick={onBack} size="sm" variant="ghost">بازگشت به سفارش‌ها</Button> : null}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-[-0.025em]">سفارش <bdi dir="ltr">#{order.orderNumber}</bdi></h1>
            <OrderStatusBadge label={orderStatusLabel(order.status)} status={order.status} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">ثبت‌شده در {formatOrderDate(order.submittedAt)}</p>
        </div>
        <p className="text-xl font-semibold"><bdi dir="ltr">{formatExactMoney(order.grandTotal, order.currency)}</bdi></p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)]">
        <div className="space-y-6">
          <OrderLines order={order} />
          <DeliveryAddress order={order} />
        </div>
        <div className="space-y-6">
          <OrderSummary order={order} />
          <OrderActionPanel actions={actions} availability={availability} />
        </div>
      </div>
    </article>
  );
}

function OrderLines({ order }: { readonly order: AdminOrder }) {
  return <section aria-labelledby="order-lines-heading" className="overflow-hidden rounded-lg border border-border bg-card"><div className="border-b border-border px-5 py-4"><h2 className="font-semibold" id="order-lines-heading">اقلام سفارش</h2><p className="mt-1 text-sm text-muted-foreground">این اطلاعات، نسخه ثبت‌شده در زمان سفارش است.</p></div><ul className="divide-y divide-border">{order.lines.map((line) => <li className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto]" key={line.variantId}><div className="min-w-0"><p className="font-medium">{line.productTitle}</p>{line.variantTitle ? <p className="mt-1 text-sm text-muted-foreground">{line.variantTitle}</p> : null}<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{fulfillmentLabel(line.fulfillmentClassification)}</span>{line.sku ? <span>کد کالا: <bdi dir="ltr">{line.sku}</bdi></span> : null}<span>تعداد: <bdi dir="ltr">{line.quantity}</bdi></span></div></div><div className="text-sm sm:text-left"><p className="font-medium"><bdi dir="ltr">{formatExactMoney(line.lineAmount, order.currency)}</bdi></p><p className="mt-1 text-xs text-muted-foreground">هر واحد <bdi dir="ltr">{formatExactMoney(line.unitAmount, order.currency)}</bdi></p></div></li>)}</ul></section>;
}

function DeliveryAddress({ order }: { readonly order: AdminOrder }) {
  const address = order.deliveryAddress;
  return <section aria-labelledby="delivery-address-heading" className="rounded-lg border border-border bg-card px-5 py-4"><h2 className="font-semibold" id="delivery-address-heading">نشانی تحویل</h2><address className="mt-3 not-italic text-sm leading-7 text-muted-foreground"><p className="font-medium text-foreground">{address.recipientName}</p><p>{address.line1}</p>{address.line2 ? <p>{address.line2}</p> : null}<p>{[address.city, address.province, address.postalCode, address.country].filter(Boolean).join('، ')}</p><p className="mt-2"><bdi dir="ltr">{address.phone}</bdi></p></address></section>;
}

function OrderSummary({ order }: { readonly order: AdminOrder }) {
  return <section aria-labelledby="order-summary-heading" className="rounded-lg border border-border bg-card px-5 py-4"><h2 className="font-semibold" id="order-summary-heading">خلاصه سفارش</h2><dl className="mt-4 space-y-3 text-sm"><SummaryRow label="روش ارسال" value={order.shippingMethodTitle} /><SummaryRow label="هزینه ارسال" value={formatExactMoney(order.shippingAmount, order.currency)} ltr /><SummaryRow label="جمع کالاها" value={formatExactMoney(order.merchandiseSubtotal, order.currency)} ltr /><div className="border-t border-border pt-3"><SummaryRow label="مبلغ قابل پرداخت" value={formatExactMoney(order.grandTotal, order.currency)} ltr strong /></div><SummaryRow label="روش پرداخت" value={paymentMethodLabel(order.paymentMethod)} /><div className="flex items-center justify-between gap-4"><dt className="text-muted-foreground">وضعیت پرداخت</dt><dd><PaymentStatusBadge label={paymentStatusLabel(order.paymentStatus)} status={order.paymentStatus} /></dd></div>{order.acceptedAt ? <SummaryRow label="زمان پذیرش" value={formatOrderDate(order.acceptedAt)} /> : null}{order.cancelledAt ? <SummaryRow label="زمان لغو" value={formatOrderDate(order.cancelledAt)} /> : null}</dl></section>;
}

function SummaryRow({ label, ltr = false, strong = false, value }: { readonly label: string; readonly value: string; readonly ltr?: boolean; readonly strong?: boolean }) {
  return <div className="flex items-start justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd className={strong ? 'font-semibold' : 'font-medium'}>{ltr ? <bdi dir="ltr">{value}</bdi> : value}</dd></div>;
}

function OrderActionPanel({ actions, availability }: { readonly actions?: OrderActionHandlers; readonly availability?: OrderActionAvailability }) {
  const [openAction, setOpenAction] = useState<'payment' | 'accept' | 'reject'>();
  const isSubmitting = availability?.isSubmitting ?? false;
  const actionIsAvailable = (action: 'payment' | 'accept' | 'reject') => action === 'payment' ? availability?.canConfirmPayment && actions?.onConfirmPayment : action === 'accept' ? availability?.canAccept && actions?.onAccept : availability?.canReject && actions?.onReject;
  const available = ['payment', 'accept', 'reject'].some((action) => actionIsAvailable(action as 'payment' | 'accept' | 'reject'));
  if (!available) return null;

  return <section aria-labelledby="order-actions-heading" className="rounded-lg border border-border bg-card px-5 py-4"><h2 className="font-semibold" id="order-actions-heading">عملیات سفارش</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">هر عملیات پس از تأیید ثبت می‌شود و ممکن است قابل بازگشت نباشد.</p><div className="mt-4 flex flex-wrap gap-2">{actionIsAvailable('payment') ? <Button onClick={() => setOpenAction('payment')} size="sm" variant="outline"><ClipboardCheck aria-hidden="true" /> تأیید پرداخت</Button> : null}{actionIsAvailable('accept') ? <Button onClick={() => setOpenAction('accept')} size="sm" variant="outline"><Check aria-hidden="true" /> پذیرش سفارش</Button> : null}{actionIsAvailable('reject') ? <Button className="text-destructive hover:text-destructive" onClick={() => setOpenAction('reject')} size="sm" variant="outline"><X aria-hidden="true" /> رد سفارش</Button> : null}</div>{openAction ? <InlineOrderAction action={openAction} isSubmitting={isSubmitting} onCancel={() => setOpenAction(undefined)} onSubmit={async (input) => { if (openAction === 'payment') await actions?.onConfirmPayment?.(input); if (openAction === 'accept') await actions?.onAccept?.({ note: input.note }); if (openAction === 'reject') await actions?.onReject?.({ note: input.note }); setOpenAction(undefined); }} /> : null}</section>;
}

function InlineOrderAction({ action, isSubmitting, onCancel, onSubmit }: { readonly action: 'payment' | 'accept' | 'reject'; readonly isSubmitting: boolean; readonly onCancel: () => void; readonly onSubmit: (input: { readonly note?: string; readonly reference?: string }) => Promise<void> }) {
  const [note, setNote] = useState('');
  const [reference, setReference] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const isPayment = action === 'payment';
  const label = isPayment ? 'تأیید پرداخت' : action === 'accept' ? 'پذیرش سفارش' : 'رد سفارش';
  const warning = action === 'reject' ? 'با رد سفارش، ادامه پردازش آن متوقف می‌شود.' : isPayment ? 'تنها پس از بررسی واقعی پرداخت، آن را تأیید کنید.' : 'پس از پذیرش، سفارش برای مرحله بعدی آماده می‌شود.';
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!confirmed || isSubmitting) return; try { await onSubmit({ note: note.trim() || undefined, reference: reference.trim() || undefined }); } catch { /* The route renders the normalized mutation problem and keeps this form open. */ } };
  return <form className="mt-5 border-t border-border pt-4" onSubmit={(event) => { void submit(event); }}><div className="flex gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm leading-6"><AlertTriangle aria-hidden="true" className="mt-1 size-4 shrink-0" /><p><span className="font-medium">{label}: </span>{warning}</p></div>{isPayment ? <label className="mt-4 block text-sm font-medium">شماره پیگیری یا مرجع پرداخت<input className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" dir="ltr" onChange={(event) => setReference(event.target.value)} value={reference} /></label> : null}<label className="mt-4 block text-sm font-medium">یادداشت {action === 'reject' ? '(پیشنهادی)' : '(اختیاری)'}<textarea className="mt-2 min-h-22 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" onChange={(event) => setNote(event.target.value)} value={note} /></label><label className="mt-4 flex cursor-pointer items-start gap-2 text-sm leading-6"><input checked={confirmed} className="mt-1 size-4 accent-primary" onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" /><span>پیامد این عملیات را بررسی کرده‌ام و انجام آن را تأیید می‌کنم.</span></label><div className="mt-4 flex flex-wrap gap-2"><Button disabled={!confirmed || isSubmitting} type="submit">{isSubmitting ? 'در حال ثبت…' : label}</Button><Button disabled={isSubmitting} onClick={onCancel} type="button" variant="ghost">انصراف</Button></div></form>;
}
