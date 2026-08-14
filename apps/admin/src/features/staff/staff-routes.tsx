import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight, Plus, RefreshCw, ShieldCheck, UserRoundCog } from 'lucide-react';
import { useEffect, useState } from 'react';
import { isAdminApiError } from '@/api/client';
import { adminRoutes } from '@/app/routes/admin-route-contract';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldDescription, FieldError, FieldLabel, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { adminSessionQueryKey } from '@/features/auth/api/auth-query';
import { PermissionBoundary } from '@/features/auth/permissions/permission-boundary';
import { hasPermission } from '@/features/auth/permissions/permissions';
import { useAdminSession } from '@/features/auth/session/use-admin-session';
import {
  activateStaffMutationOptions, createStaffMutationOptions, replaceStaffRolesMutationOptions,
  staffListQueryOptions, staffQueryKeys, staffRolesQueryOptions, suspendStaffMutationOptions,
  type StaffProfile, type StaffRole,
} from './api';

const staffRouteApi = getRouteApi('/staff');

export function StaffRoute() {
  return <PermissionBoundary required={adminRoutes.staff.permissions}><StaffContent /></PermissionBoundary>;
}

function StaffContent() {
  const actor = useAdminSession();
  const client = useQueryClient();
  const search = staffRouteApi.useSearch();
  const navigate = staffRouteApi.useNavigate();
  const cursor = search.cursor;
  const previous = search.history ?? [];
  const canReadRoles = hasPermission(actor.permissions, 'roles.read');
  const staff = useQuery(staffListQueryOptions(cursor));
  const roles = useQuery(staffRolesQueryOptions(canReadRoles));
  const create = useMutation(createStaffMutationOptions());
  const replaceRoles = useMutation(replaceStaffRolesMutationOptions());
  const suspend = useMutation(suspendStaffMutationOptions());
  const activate = useMutation(activateStaffMutationOptions());
  const canCreate = hasPermission(actor.permissions, 'staff.create');
  const canAssignRoles = hasPermission(actor.permissions, 'staff.assign_roles');
  const canAssignOwner = hasPermission(actor.permissions, 'staff.assign_owner');
  const canSuspend = hasPermission(actor.permissions, 'staff.suspend');
  const mutationError = create.error ?? replaceRoles.error ?? suspend.error ?? activate.error;
  const pending = create.isPending || replaceRoles.isPending || suspend.isPending || activate.isPending;

  const refresh = async (changed?: StaffProfile) => {
    await client.invalidateQueries({ queryKey: staffQueryKeys.all });
    if (changed?.userId === actor.userId) await client.invalidateQueries({ queryKey: adminSessionQueryKey });
  };
  const setPage = (nextCursor: string | undefined, history: readonly string[]) => {
    void navigate({ to: adminRoutes.staff.path, search: (current) => ({ ...current, cursor: nextCursor, history: [...history] }) });
  };

  useEffect(() => {
    if (isAdminApiError(mutationError) && mutationError.problem.kind === 'api' && [403, 409].includes(mutationError.problem.status)) {
      void client.invalidateQueries({ queryKey: staffQueryKeys.all });
    }
  }, [client, mutationError]);

  if (staff.isPending || (canReadRoles && roles.isPending)) return <Loading />;
  if (staff.isError || (canReadRoles && roles.isError)) return <Failure error={staff.error ?? roles.error} onRetry={() => { void staff.refetch(); void roles.refetch(); }} />;
  const assignableRoles = canReadRoles ? roles.data ?? [] : [];

  return <main className="mx-auto max-w-6xl space-y-6" dir="rtl">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-semibold tracking-[-0.025em]">کارکنان و نقش‌ها</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">اعضای تیم و سطح دسترسی هر شخص را از یک محل مدیریت کنید.</p></div>
      {canCreate && canAssignRoles ? <CreateStaffDialog disabled={pending} roles={assignableRoles} canAssignOwner={canAssignOwner} onSubmit={async (userId, roleKeys) => { const result = await create.mutateAsync({ userId, roleKeys }); await refresh(result); }} /> : null}
    </header>
    {mutationError ? <Problem error={mutationError} /> : null}
    {!canReadRoles ? <div className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">جزئیات نقش‌ها برای حساب شما قابل مشاهده نیست؛ نقش‌های فعلی اعضا همچنان نمایش داده می‌شوند.</div> : null}
    {staff.data.data.length === 0 ? <EmptyStaff /> : <div className="grid gap-4 xl:grid-cols-2">{staff.data.data.map((member) => <StaffCard key={member.userId} member={member} roles={assignableRoles} disabled={pending} canAssignOwner={canAssignOwner} canAssignRoles={canAssignRoles} canSuspend={canSuspend} onRoles={async (roleKeys) => { const result = await replaceRoles.mutateAsync({ userId: member.userId, roleKeys }); await refresh(result); }} onStatus={async () => { const result = member.status === 'active' ? await suspend.mutateAsync(member.userId) : await activate.mutateAsync(member.userId); await refresh(result); }} />)}</div>}
    <nav aria-label="صفحه‌بندی کارکنان" className="flex items-center justify-between gap-3"><Button disabled={previous.length === 0 || pending} onClick={() => { const next = [...previous]; const prior = next.pop(); setPage(prior || undefined, next); }} size="sm" variant="outline"><ChevronRight aria-hidden="true" /> قبلی</Button><Button disabled={!staff.data.nextCursor || pending} onClick={() => setPage(staff.data.nextCursor ?? undefined, [...previous, cursor ?? ''])} size="sm" variant="outline">بعدی <ChevronLeft aria-hidden="true" /></Button></nav>
  </main>;
}

function StaffCard(props: { readonly member: StaffProfile; readonly roles: readonly StaffRole[]; readonly disabled: boolean; readonly canAssignRoles: boolean; readonly canAssignOwner: boolean; readonly canSuspend: boolean; readonly onRoles: (keys: readonly string[]) => Promise<void>; readonly onStatus: () => Promise<void> }) {
  const { member, roles, disabled, canAssignRoles, canAssignOwner, canSuspend, onRoles, onStatus } = props;
  const [editing, setEditing] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState(false);
  const protectedOwner = member.roles.includes('owner') && !canAssignOwner;
  return <Card><CardHeader className="flex-row items-start justify-between gap-4"><div className="min-w-0"><CardTitle className="truncate text-base"><bdi dir="ltr">{member.email}</bdi></CardTitle><p className="mt-1 truncate text-xs text-muted-foreground" title={member.userId}><bdi dir="ltr">{member.userId}</bdi></p></div><StatusBadge tone={member.status === 'active' ? 'success' : 'warning'}>{member.status === 'active' ? 'فعال' : 'معلق'}</StatusBadge></CardHeader><CardContent className="space-y-5"><div><p className="mb-2 text-xs font-medium text-muted-foreground">نقش‌های فعلی</p><div className="flex flex-wrap gap-2">{member.roles.length ? member.roles.map((role) => <StatusBadge key={role}><bdi dir="ltr">{role}</bdi></StatusBadge>) : <span className="text-sm text-muted-foreground">بدون نقش</span>}</div></div><div className="flex flex-wrap gap-2">{canAssignRoles && !protectedOwner ? <Button disabled={disabled} onClick={() => setEditing(true)} size="sm" variant="outline">ویرایش نقش‌ها</Button> : null}{canSuspend && !protectedOwner ? <Button disabled={disabled} onClick={() => setConfirmStatus(true)} size="sm" variant="ghost" className="text-destructive">{member.status === 'active' ? 'تعلیق دسترسی' : 'فعال‌سازی دسترسی'}</Button> : null}</div></CardContent>
    <RoleDialog key={member.roles.join(':')} member={member} roles={roles} disabled={disabled} canAssignOwner={canAssignOwner} open={editing} onOpenChange={setEditing} onSubmit={onRoles} />
    <AlertDialog open={confirmStatus} onOpenChange={setConfirmStatus}><AlertDialogContent dir="rtl"><AlertDialogHeader><AlertDialogTitle>{member.status === 'active' ? 'دسترسی این کارمند تعلیق شود؟' : 'دسترسی این کارمند فعال شود؟'}</AlertDialogTitle><AlertDialogDescription>{member.status === 'active' ? 'این شخص تا زمان فعال‌سازی دوباره نمی‌تواند وارد پنل مدیریت شود.' : 'این شخص دوباره می‌تواند با نقش‌های فعلی وارد پنل مدیریت شود.'}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={disabled}>انصراف</AlertDialogCancel><AlertDialogAction disabled={disabled} onClick={() => { void onStatus().then(() => setConfirmStatus(false)); }}>{disabled ? 'در حال ثبت…' : 'تأیید'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </Card>;
}

function CreateStaffDialog({ disabled, roles, canAssignOwner, onSubmit }: { readonly disabled: boolean; readonly roles: readonly StaffRole[]; readonly canAssignOwner: boolean; readonly onSubmit: (userId: string, roleKeys: readonly string[]) => Promise<void> }) {
  const [open, setOpen] = useState(false); const [userId, setUserId] = useState(''); const [selected, setSelected] = useState<readonly string[]>([]); const valid = isUuid(userId) && selected.length > 0;
  return <><Button onClick={() => setOpen(true)}><Plus aria-hidden="true" /> افزودن کارمند</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent dir="rtl"><DialogHeader><DialogTitle>افزودن کارمند</DialogTitle><DialogDescription>کاربر موجود را با شناسه او به تیم اضافه و نقش‌های اولیه را انتخاب کنید.</DialogDescription></DialogHeader><form className="space-y-5" onSubmit={(event) => { event.preventDefault(); if (!valid) return; void onSubmit(userId.trim(), selected).then(() => { setOpen(false); setUserId(''); setSelected([]); }); }}><Field data-invalid={userId.length > 0 && !isUuid(userId)}><FieldLabel htmlFor="staff-user-id">شناسه کاربر</FieldLabel><Input id="staff-user-id" dir="ltr" onChange={(event) => setUserId(event.target.value)} placeholder="UUID" value={userId} aria-invalid={userId.length > 0 && !isUuid(userId)} /><FieldDescription>شناسه کاربری که پیش‌تر در سامانه ثبت شده است.</FieldDescription>{userId.length > 0 && !isUuid(userId) ? <FieldError>شناسه کاربر معتبر نیست.</FieldError> : null}</Field><RoleChoices roles={availableRoles(roles, canAssignOwner)} selected={selected} onChange={setSelected} /><DialogFooter><Button disabled={disabled || !valid} type="submit">{disabled ? 'در حال افزودن…' : 'افزودن به تیم'}</Button><Button disabled={disabled} onClick={() => setOpen(false)} type="button" variant="outline">انصراف</Button></DialogFooter></form></DialogContent></Dialog></>;
}

function RoleDialog({ member, roles, disabled, canAssignOwner, open, onOpenChange, onSubmit }: { readonly member: StaffProfile; readonly roles: readonly StaffRole[]; readonly disabled: boolean; readonly canAssignOwner: boolean; readonly open: boolean; readonly onOpenChange: (open: boolean) => void; readonly onSubmit: (keys: readonly string[]) => Promise<void> }) {
  const [selected, setSelected] = useState<readonly string[]>(member.roles);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent dir="rtl"><DialogHeader><DialogTitle>ویرایش نقش‌های کارمند</DialogTitle><DialogDescription><bdi dir="ltr">{member.email}</bdi> — انتخاب جدید جایگزین همه نقش‌های فعلی می‌شود.</DialogDescription></DialogHeader><RoleChoices roles={availableRoles(roles, canAssignOwner)} selected={selected} onChange={setSelected} /><DialogFooter><Button disabled={disabled || selected.length === 0} onClick={() => { void onSubmit(selected).then(() => onOpenChange(false)); }}>{disabled ? 'در حال ثبت…' : 'ثبت نقش‌ها'}</Button><Button disabled={disabled} onClick={() => onOpenChange(false)} variant="outline">انصراف</Button></DialogFooter></DialogContent></Dialog>;
}

function RoleChoices({ roles, selected, onChange }: { readonly roles: readonly StaffRole[]; readonly selected: readonly string[]; readonly onChange: (keys: readonly string[]) => void }) {
  if (!roles.length) return <p className="text-sm text-muted-foreground">هیچ نقش قابل انتسابی برای این حساب در دسترس نیست.</p>;
  return <FieldSet><legend className="text-sm font-medium">نقش‌ها</legend><div className="grid gap-2 sm:grid-cols-2">{roles.map((role) => { const checked = selected.includes(role.key); return <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5" key={role.key}><Checkbox checked={checked} onCheckedChange={() => onChange(checked ? selected.filter((key) => key !== role.key) : [...selected, role.key])} /><span className="min-w-0"><span className="block text-sm font-medium"><bdi dir="ltr">{role.name}</bdi></span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{role.description}</span></span></label>; })}</div></FieldSet>;
}

function availableRoles(roles: readonly StaffRole[], canAssignOwner: boolean) { return roles.filter((role) => role.key !== 'owner' || canAssignOwner); }
function EmptyStaff() { return <Empty className="min-h-64 border"><EmptyHeader><EmptyMedia variant="icon"><UserRoundCog /></EmptyMedia><EmptyTitle>کارمندی ثبت نشده است</EmptyTitle><EmptyDescription>برای شروع، یک کاربر موجود را به تیم مدیریت اضافه کنید.</EmptyDescription></EmptyHeader></Empty>; }
function Loading() { return <main aria-busy="true" className="mx-auto max-w-6xl space-y-5" dir="rtl"><Skeleton className="h-9 w-52" /><div className="grid gap-4 xl:grid-cols-2">{Array.from({ length: 4 }, (_, index) => <Skeleton className="h-48" key={index} />)}</div></main>; }
function Failure({ error, onRetry }: { readonly error: unknown; readonly onRetry: () => void }) { return <main className="mx-auto max-w-xl rounded-xl border bg-card p-6" dir="rtl" role="alert"><ShieldCheck className="size-8 text-destructive" /><h1 className="mt-4 font-semibold">فهرست کارکنان دریافت نشد</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{message(error)}</p><Button className="mt-4" onClick={onRetry} variant="outline"><RefreshCw aria-hidden="true" /> تلاش دوباره</Button></main>; }
function Problem({ error }: { readonly error: unknown }) { return <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm" role="alert">{message(error)}</div>; }
function message(error: unknown) { if (isAdminApiError(error) && error.problem.kind === 'api') { if (error.problem.status === 403) return 'اجازه انجام این عملیات را ندارید. اطلاعات تیم تازه‌سازی شد.'; if (error.problem.status === 409) return 'اطلاعات این کارمند تغییر کرده است. فهرست تازه‌سازی شد؛ دوباره بررسی کنید.'; if (error.problem.status === 404) return 'کاربر یا نقش موردنظر یافت نشد.'; } return 'ارتباط با سرویس کارکنان برقرار نشد. چند لحظه دیگر دوباره تلاش کنید.'; }
function isUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim()); }
