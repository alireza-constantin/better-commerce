import { ChevronLeft, ChevronRight, ClipboardList, Eye, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { CommerceAuditEvent, CommerceAuditPage } from '../api';
import { auditActionLabel, auditTargetLabel } from './audit-presenters';

export interface CommerceAuditEventsProps {
  readonly page?: CommerceAuditPage;
  readonly heading?: string;
  readonly description?: string;
  readonly emptyTitle?: string;
  readonly isLoading?: boolean;
  readonly isFetching?: boolean;
  readonly hasPreviousPage?: boolean;
  readonly error?: string;
  readonly onNextPage?: () => void;
  readonly onPreviousPage?: () => void;
  readonly onRetry?: () => void;
}

export function CommerceAuditEvents({ error, hasPreviousPage = false, isFetching = false, isLoading = false, onNextPage, onPreviousPage, onRetry, page, heading, description, emptyTitle }: CommerceAuditEventsProps) {
  const [selected, setSelected] = useState<CommerceAuditEvent>();
  if (isLoading) return <CommerceAuditLoading />;
  if (error) return <CommerceAuditError error={error} onRetry={onRetry} />;
  if (!page || page.items.length === 0) return <CommerceAuditEmpty title={emptyTitle ?? 'هنوز رویدادی ثبت نشده است'} />;

  return <section aria-labelledby="commerce-audit-heading" className="space-y-5" dir="rtl">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold tracking-[-0.025em]" id="commerce-audit-heading">{heading ?? 'فعالیت فروشگاه'}</h1><p className="mt-1 text-sm leading-6 text-muted-foreground">{description ?? 'تغییرات مهم فروشگاه را از جدیدترین رویداد تا قدیمی‌ترین دنبال کنید.'}</p></div><StatusBadge>{page.items.length.toLocaleString('fa-IR')} رویداد در این صفحه</StatusBadge></header>

    <div className="grid gap-3 md:hidden">{page.items.map((event) => <Card key={event.id}><CardContent className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{auditActionLabel(event.action)}</p><time className="mt-1 block text-xs text-muted-foreground" dateTime={event.createdAt}>{formatExactDate(event.createdAt)}</time></div><Button aria-label="مشاهده جزئیات رویداد" onClick={() => setSelected(event)} size="icon" variant="ghost"><Eye /></Button></div><div className="grid grid-cols-2 gap-3 text-sm"><CompactText label="بخش" value={auditTargetLabel(event.targetType)} /><CompactText label="انجام‌دهنده" value={event.actorUserId ? 'کارمند' : 'سامانه'} /></div></CardContent></Card>)}</div>

    <Card className="hidden md:block"><Table><TableHeader><TableRow><TableHead scope="col">رویداد</TableHead><TableHead scope="col">زمان</TableHead><TableHead scope="col">بخش</TableHead><TableHead scope="col">انجام‌دهنده</TableHead><TableHead scope="col"><span className="sr-only">جزئیات</span></TableHead></TableRow></TableHeader><TableBody>{page.items.map((event) => <TableRow key={event.id}><TableCell className="font-medium">{auditActionLabel(event.action)}</TableCell><TableCell className="whitespace-nowrap text-muted-foreground"><time dateTime={event.createdAt} title={toIso(event.createdAt)}>{formatExactDate(event.createdAt)}</time></TableCell><TableCell>{auditTargetLabel(event.targetType)}</TableCell><TableCell>{event.actorUserId ? 'کارمند' : 'سامانه'}</TableCell><TableCell><Button onClick={() => setSelected(event)} size="sm" variant="ghost"><Eye /> جزئیات</Button></TableCell></TableRow>)}</TableBody></Table></Card>

    <nav aria-label="صفحه‌بندی ممیزی فروشگاه" className="flex items-center justify-between gap-3"><Button disabled={!hasPreviousPage || isFetching} onClick={onPreviousPage} variant="outline"><ChevronRight /> صفحه پیشین</Button><Button disabled={!page.nextCursor || isFetching} onClick={onNextPage} variant="outline">صفحه بعد <ChevronLeft /></Button></nav>
    <EventDialog event={selected} onOpenChange={(open) => { if (!open) setSelected(undefined); }} />
  </section>;
}

function EventDialog({ event, onOpenChange }: { readonly event?: CommerceAuditEvent; readonly onOpenChange: (open: boolean) => void }) {
  return <Dialog open={Boolean(event)} onOpenChange={onOpenChange}><DialogContent className="max-w-2xl" dir="rtl"><DialogHeader><DialogTitle>{event ? auditActionLabel(event.action) : 'جزئیات رویداد'}</DialogTitle><DialogDescription>این اطلاعات فقط برای پیگیری و بررسی نمایش داده می‌شود.</DialogDescription></DialogHeader>{event ? <div className="space-y-5"><dl className="grid gap-4 text-sm sm:grid-cols-2"><Detail label="زمان دقیق" value={formatExactDate(event.createdAt)} /><Detail label="کد رویداد" value={event.action} technical /><Detail label="شناسه رویداد" value={event.id} technical /><Detail label="شناسه درخواست" value={event.requestId} technical emptyLabel="ثبت نشده" /><Detail label="نوع هدف" value={event.targetType} technical /><Detail label="شناسه هدف" value={event.targetId} technical /><Detail label="عامل" value={event.actorUserId} technical emptyLabel="سامانه" /></dl><div><p className="mb-2 text-sm font-medium">فراداده</p><pre className="max-h-72 overflow-auto rounded-lg bg-muted p-4 text-left text-xs leading-6" dir="ltr">{safeJson(event.metadata)}</pre></div></div> : null}</DialogContent></Dialog>;
}

function CompactText({ label, value }: { readonly label: string; readonly value: string }) { return <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 truncate">{value}</p></div>; }
function Detail({ emptyLabel = '—', label, technical = false, value }: { readonly label: string; readonly value: string | null; readonly technical?: boolean; readonly emptyLabel?: string }) { return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-all font-medium">{technical && value ? <bdi dir="ltr">{value}</bdi> : value ?? emptyLabel}</dd></div>; }
function CommerceAuditLoading() { return <section aria-busy="true" aria-label="در حال دریافت رویدادها" className="space-y-5" dir="rtl"><Skeleton className="h-9 w-48" /><Card className="space-y-2 p-4">{Array.from({ length: 5 }, (_, index) => <Skeleton className="h-12" key={index} />)}</Card></section>; }
function CommerceAuditEmpty({ title }: { readonly title: string }) { return <Empty className="min-h-64 border" dir="rtl"><EmptyHeader><EmptyMedia variant="icon"><ClipboardList /></EmptyMedia><EmptyTitle>{title}</EmptyTitle><EmptyDescription>پس از انجام عملیات فروشگاه، رویدادهای مربوط در این بخش نمایش داده می‌شوند.</EmptyDescription></EmptyHeader></Empty>; }
function CommerceAuditError({ error, onRetry }: { readonly error: string; readonly onRetry?: () => void }) { return <Card className="mx-auto max-w-xl" dir="rtl" role="alert"><CardContent className="p-6"><h1 className="font-semibold">دریافت رویدادهای ممیزی انجام نشد</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{error}</p>{onRetry ? <Button className="mt-4" onClick={onRetry} variant="outline"><RefreshCw /> تلاش دوباره</Button> : null}</CardContent></Card>; }
function formatExactDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'medium' }).format(date); }
function toIso(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toISOString(); }
function safeJson(value: unknown) { try { return JSON.stringify(value, null, 2) ?? 'null'; } catch { return 'null'; } }
