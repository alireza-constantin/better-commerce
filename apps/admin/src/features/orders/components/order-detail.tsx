import { AlertTriangle, Check, ChevronRight, ClipboardCheck, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field as FormField,
  FieldLabel,
  Input,
  Textarea,
} from '@/components/ui';
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
  readonly onConfirmPayment?: (input: { readonly note?: string; readonly reference?: string }) => void | Promise<void>;
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

export function OrderDetail({ actions, availability, onBack, order }: OrderDetailProps) {
  return (
    <article className="mx-auto flex max-w-[90rem] flex-col gap-4" dir="rtl">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          {onBack ? (
            <Button className="mb-3 -me-2" onClick={onBack} size="sm" variant="ghost">
              <ChevronRight aria-hidden="true" /> بازگشت به سفارش‌ها
            </Button>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">سفارش <bdi dir="ltr">#{order.orderNumber}</bdi></h1>
            <OrderStatusBadge label={orderStatusLabel(order.status)} status={order.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">ثبت‌شده در {formatOrderDate(order.submittedAt)}</p>
        </div>
        <div className="text-left">
          <p className="text-xs text-muted-foreground">مبلغ سفارش</p>
          <p className="mt-1 text-xl font-semibold" dir="ltr">{formatExactMoney(order.grandTotal, order.currency)}</p>
        </div>
      </header>

      <OrderTimeline order={order} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.75fr)] lg:items-start">
        <div className="flex flex-col gap-4">
          <OrderLines order={order} />
          <DeliveryAddress order={order} />
        </div>
        <div className="flex flex-col gap-4 lg:sticky lg:top-20">
          <OrderSummary order={order} />
          <OrderActionPanel actions={actions} availability={availability} />
        </div>
      </div>
    </article>
  );
}

function OrderTimeline({ order }: { readonly order: AdminOrder }) {
  const steps = [
    { label: 'ثبت سفارش', complete: true, time: order.submittedAt },
    { label: 'پذیرش', complete: Boolean(order.acceptedAt), time: order.acceptedAt },
    { label: order.status === 'cancelled' ? 'لغوشده' : 'تکمیل', complete: order.status === 'cancelled' || order.status === 'completed', time: order.cancelledAt },
  ];
  return (
    <Card aria-label="روند سفارش">
      <CardContent className="py-4">
        <ol className="grid gap-3 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li className="flex items-start gap-3" key={step.label}>
              <span className={step.complete ? 'flex size-7 shrink-0 items-center justify-center rounded-full bg-success text-xs text-white' : 'flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground'}>{index + 1}</span>
              <div>
                <p className="text-sm font-medium">{step.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{step.complete ? formatOrderDate(step.time) : 'در انتظار'}</p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function OrderLines({ order }: { readonly order: AdminOrder }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>اقلام سفارش</CardTitle>
        <CardDescription>اطلاعات ثبت‌شده در لحظه سفارش؛ تغییرات بعدی کالا روی این سند اثر ندارد.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {order.lines.map((line) => (
            <li className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto]" key={line.variantId}>
              <div className="min-w-0">
                <p className="font-medium">{line.productTitle}</p>
                {line.variantTitle ? <p className="mt-1 text-sm text-muted-foreground">{line.variantTitle}</p> : null}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{fulfillmentLabel(line.fulfillmentClassification)}</span>
                  {line.sku ? <span>کد کالا: <bdi dir="ltr">{line.sku}</bdi></span> : null}
                  <span>تعداد: <bdi dir="ltr">{line.quantity}</bdi></span>
                </div>
              </div>
              <div className="text-sm sm:text-left">
                <p className="font-medium"><bdi dir="ltr">{formatExactMoney(line.lineAmount, order.currency)}</bdi></p>
                <p className="mt-1 text-xs text-muted-foreground">هر واحد <bdi dir="ltr">{formatExactMoney(line.unitAmount, order.currency)}</bdi></p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function DeliveryAddress({ order }: { readonly order: AdminOrder }) {
  const address = order.deliveryAddress;
  return (
    <Card>
      <CardHeader><CardTitle>نشانی تحویل</CardTitle></CardHeader>
      <CardContent>
        <address className="not-italic text-sm leading-7 text-muted-foreground">
          <p className="font-medium text-foreground">{address.recipientName}</p>
          <p>{address.line1}</p>
          {address.line2 ? <p>{address.line2}</p> : null}
          <p>{[address.city, address.province, address.postalCode, address.country].filter(Boolean).join('، ')}</p>
          <p className="mt-2"><bdi dir="ltr">{address.phone}</bdi></p>
        </address>
      </CardContent>
    </Card>
  );
}

function OrderSummary({ order }: { readonly order: AdminOrder }) {
  return (
    <Card>
      <CardHeader><CardTitle>خلاصه سفارش</CardTitle></CardHeader>
      <CardContent>
        <dl className="space-y-3 text-sm">
          <SummaryRow label="روش ارسال" value={order.shippingMethodTitle} />
          <SummaryRow label="هزینه ارسال" value={formatExactMoney(order.shippingAmount, order.currency)} ltr />
          <SummaryRow label="جمع کالاها" value={formatExactMoney(order.merchandiseSubtotal, order.currency)} ltr />
          <div className="border-t border-border pt-3"><SummaryRow label="مبلغ قابل پرداخت" value={formatExactMoney(order.grandTotal, order.currency)} ltr strong /></div>
          <SummaryRow label="روش پرداخت" value={paymentMethodLabel(order.paymentMethod)} />
          <div className="flex items-center justify-between gap-4"><dt className="text-muted-foreground">وضعیت پرداخت</dt><dd><PaymentStatusBadge label={paymentStatusLabel(order.paymentStatus)} status={order.paymentStatus} /></dd></div>
          {order.acceptedAt ? <SummaryRow label="زمان پذیرش" value={formatOrderDate(order.acceptedAt)} /> : null}
          {order.cancelledAt ? <SummaryRow label="زمان لغو" value={formatOrderDate(order.cancelledAt)} /> : null}
        </dl>
      </CardContent>
    </Card>
  );
}

function SummaryRow({ label, ltr = false, strong = false, value }: { readonly label: string; readonly value: string; readonly ltr?: boolean; readonly strong?: boolean }) {
  return <div className="flex items-start justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd className={strong ? 'font-semibold' : 'font-medium'}>{ltr ? <bdi dir="ltr">{value}</bdi> : value}</dd></div>;
}

type OrderAction = 'payment' | 'accept' | 'reject';

function OrderActionPanel({ actions, availability }: { readonly actions?: OrderActionHandlers; readonly availability?: OrderActionAvailability }) {
  const [openAction, setOpenAction] = useState<OrderAction>();
  const isSubmitting = availability?.isSubmitting ?? false;
  const actionIsAvailable = (action: OrderAction) => action === 'payment' ? availability?.canConfirmPayment && actions?.onConfirmPayment : action === 'accept' ? availability?.canAccept && actions?.onAccept : availability?.canReject && actions?.onReject;
  if (!(['payment', 'accept', 'reject'] as const).some(actionIsAvailable)) return null;

  const submit = async (input: { readonly note?: string; readonly reference?: string }) => {
    if (!openAction) return;
    if (openAction === 'payment') await actions?.onConfirmPayment?.(input);
    if (openAction === 'accept') await actions?.onAccept?.({ note: input.note });
    if (openAction === 'reject') await actions?.onReject?.({ note: input.note });
    setOpenAction(undefined);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>اقدام بعدی</CardTitle>
        <CardDescription>عملیات موجود بر اساس وضعیت فعلی سفارش و دسترسی شما نمایش داده می‌شود.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {actionIsAvailable('payment') ? <Button onClick={() => setOpenAction('payment')} size="sm" variant="outline"><ClipboardCheck aria-hidden="true" /> تأیید پرداخت</Button> : null}
        {actionIsAvailable('accept') ? <Button onClick={() => setOpenAction('accept')} size="sm"><Check aria-hidden="true" /> پذیرش سفارش</Button> : null}
        {actionIsAvailable('reject') ? <Button onClick={() => setOpenAction('reject')} size="sm" variant="destructive"><X aria-hidden="true" /> رد سفارش</Button> : null}
      </CardContent>
      <Dialog onOpenChange={(open) => { if (!open && !isSubmitting) setOpenAction(undefined); }} open={Boolean(openAction)}>
        <DialogContent dir="rtl">
          {openAction ? <InlineOrderAction action={openAction} isSubmitting={isSubmitting} onCancel={() => setOpenAction(undefined)} onSubmit={submit} /> : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function InlineOrderAction({ action, isSubmitting, onCancel, onSubmit }: { readonly action: OrderAction; readonly isSubmitting: boolean; readonly onCancel: () => void; readonly onSubmit: (input: { readonly note?: string; readonly reference?: string }) => Promise<void> }) {
  const [note, setNote] = useState('');
  const [reference, setReference] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const isPayment = action === 'payment';
  const label = isPayment ? 'تأیید پرداخت' : action === 'accept' ? 'پذیرش سفارش' : 'رد سفارش';
  const warning = action === 'reject' ? 'با رد سفارش، ادامه پردازش آن متوقف می‌شود.' : isPayment ? 'تنها پس از بررسی واقعی پرداخت، آن را تأیید کنید.' : 'پس از پذیرش، سفارش برای مرحله بعدی آماده می‌شود.';
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!confirmed || isSubmitting) return;
    try { await onSubmit({ note: note.trim() || undefined, reference: reference.trim() || undefined }); } catch { /* Normalized route error remains visible while dialog stays open. */ }
  };
  return (
    <form onSubmit={(event) => { void submit(event); }}>
      <DialogHeader>
        <DialogTitle>{label}</DialogTitle>
        <DialogDescription>{warning}</DialogDescription>
      </DialogHeader>
      <div className="my-4 flex gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm leading-6">
        <AlertTriangle aria-hidden="true" className="mt-1 size-4 shrink-0" />
        <p>این اقدام در تاریخچه سفارش ثبت می‌شود.</p>
      </div>
      <div className="flex flex-col gap-4">
        {isPayment ? (
          <FormField>
            <FieldLabel htmlFor="payment-reference">شماره پیگیری یا مرجع پرداخت</FieldLabel>
            <Input dir="ltr" id="payment-reference" onChange={(event) => setReference(event.target.value)} value={reference} />
          </FormField>
        ) : null}
        <FormField>
          <FieldLabel htmlFor="order-action-note">یادداشت {action === 'reject' ? '(پیشنهادی)' : '(اختیاری)'}</FieldLabel>
          <Textarea id="order-action-note" onChange={(event) => setNote(event.target.value)} value={note} />
        </FormField>
        <label className="flex cursor-pointer items-start gap-2 text-sm leading-6" htmlFor="confirm-order-action">
          <Checkbox checked={confirmed} id="confirm-order-action" onCheckedChange={(value) => setConfirmed(value === true)} />
          <span>پیامد این عملیات را بررسی کرده‌ام و انجام آن را تأیید می‌کنم.</span>
        </label>
      </div>
      <DialogFooter className="mt-5">
        <Button disabled={!confirmed || isSubmitting} type="submit" variant={action === 'reject' ? 'destructive' : 'default'}>{isSubmitting ? 'در حال ثبت…' : label}</Button>
        <Button disabled={isSubmitting} onClick={onCancel} type="button" variant="ghost">انصراف</Button>
      </DialogFooter>
    </form>
  );
}
