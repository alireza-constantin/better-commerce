import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight, Plus, RefreshCw, UserRoundCog } from 'lucide-react';
import { useEffect, useState } from 'react';
import { isAdminApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { PermissionBoundary } from '@/features/auth/permissions/permission-boundary';
import { hasPermission } from '@/features/auth/permissions/permissions';
import { adminSessionQueryKey } from '@/features/auth/api/auth-query';
import { useAdminSession } from '@/features/auth/session/use-admin-session';
import { adminRoutes } from '@/app/routes/admin-route-contract';
import {
  activateStaffMutationOptions,
  createStaffMutationOptions,
  replaceStaffRolesMutationOptions,
  staffListQueryOptions,
  staffQueryKeys,
  staffRolesQueryOptions,
  suspendStaffMutationOptions,
  type StaffProfile,
  type StaffRole,
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
  const setPage = (nextCursor: string | undefined, history: readonly string[]) => {
    void navigate({
      to: adminRoutes.staff.path,
      search: (current) => ({
        ...current,
        cursor: nextCursor,
        history: [...history],
      }),
    });
  };
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
  useEffect(() => {
    if (isAdminApiError(mutationError) && mutationError.problem.kind === 'api' && (mutationError.problem.status === 403 || mutationError.problem.status === 409)) {
      void client.invalidateQueries({ queryKey: staffQueryKeys.all });
    }
  }, [client, mutationError]); // Refreshing server-owned state is intentional after denied/stale writes.

  if (staff.isPending || (canReadRoles && roles.isPending)) return <Loading />;
  if (staff.isError || (canReadRoles && roles.isError)) return <Failure error={staff.error ?? roles.error} onRetry={() => { void staff.refetch(); void roles.refetch(); }} />;
  const assignableRoles = canReadRoles ? roles.data ?? [] : [];
  return <main className="mx-auto max-w-6xl space-y-6" dir="rtl">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-semibold tracking-[-0.025em]">کارکنان و نقش‌ها</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">دسترسی کارکنان فقط با مجوزهای دقیق سرویس مدیریت می‌شود.</p></div>
      {canCreate && canAssignRoles ? <CreateStaffForm disabled={pending} roles={assignableRoles} canAssignOwner={canAssignOwner} canAssignRoles={canAssignRoles} onSubmit={async (userId, roleKeys) => { const result = await create.mutateAsync({ userId, roleKeys }); await refresh(result); }} /> : null}
    </header>
    {mutationError ? <Problem error={mutationError} /> : null}
    {!canReadRoles ? <p className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">مجوز مشاهده جزئیات نقش‌ها را ندارید؛ نقش‌های فعلی کارکنان همچنان نمایش داده می‌شوند.</p> : null}
    {staff.data.data.length === 0 ? <Empty /> : <div className="space-y-3">{staff.data.data.map((member) => <StaffCard key={member.userId} member={member} roles={assignableRoles} disabled={pending} canAssignOwner={canAssignOwner} canAssignRoles={canAssignRoles} canSuspend={canSuspend} onRoles={async (roleKeys) => { const result = await replaceRoles.mutateAsync({ userId: member.userId, roleKeys }); await refresh(result); }} onStatus={async () => { const result = member.status === 'active' ? await suspend.mutateAsync(member.userId) : await activate.mutateAsync(member.userId); await refresh(result); }} />)}</div>}
    <nav aria-label="صفحه‌بندی کارکنان" className="flex items-center justify-between gap-3"><Button disabled={previous.length === 0 || pending} onClick={() => { const next = [...previous]; const prior = next.pop(); setPage(prior || undefined, next); }} size="sm" variant="outline"><ChevronRight aria-hidden="true" /> قبلی</Button><Button disabled={!staff.data.nextCursor || pending} onClick={() => { setPage(staff.data.nextCursor ?? undefined, [...previous, cursor ?? '']); }} size="sm" variant="outline">بعدی <ChevronLeft aria-hidden="true" /></Button></nav>
  </main>;
}

function StaffCard({ member, roles, disabled, canAssignRoles, canAssignOwner, canSuspend, onRoles, onStatus }: { readonly member: StaffProfile; readonly roles: readonly StaffRole[]; readonly disabled: boolean; readonly canAssignRoles: boolean; readonly canAssignOwner: boolean; readonly canSuspend: boolean; readonly onRoles: (keys: readonly string[]) => Promise<void>; readonly onStatus: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const canEditRoles = canAssignRoles && (!member.roles.includes('owner') || canAssignOwner);
  const canChangeStatus = canSuspend && (!member.roles.includes('owner') || canAssignOwner);
  return <section className="rounded-lg border border-border bg-card p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-medium"><bdi dir="ltr">{member.email}</bdi></h2><p className="mt-1 text-xs text-muted-foreground"><bdi dir="ltr">{member.userId}</bdi></p><div className="mt-3 flex flex-wrap gap-2">{member.roles.length ? member.roles.map((role) => <span className="rounded-full bg-muted px-2 py-0.5 text-xs" key={role}><bdi dir="ltr">{role}</bdi></span>) : <span className="text-sm text-muted-foreground">بدون نقش</span>}</div></div><div className="flex flex-wrap items-center gap-2"><Status status={member.status} />{canEditRoles ? <Button disabled={disabled} onClick={() => setEditing((value) => !value)} size="sm" variant="outline">تغییر نقش‌ها</Button> : null}{canChangeStatus ? <ConfirmedAction disabled={disabled} label={member.status === 'active' ? 'تعلیق دسترسی' : 'فعال‌سازی دسترسی'} onConfirm={onStatus} /> : null}</div></div>{editing ? <RoleEditor member={member} roles={roles} disabled={disabled} canAssignOwner={canAssignOwner} onCancel={() => setEditing(false)} onSubmit={async (keys) => { await onRoles(keys); setEditing(false); }} /> : null}</section>;
}

function CreateStaffForm({ disabled, roles, canAssignRoles, canAssignOwner, onSubmit }: { readonly disabled: boolean; readonly roles: readonly StaffRole[]; readonly canAssignRoles: boolean; readonly canAssignOwner: boolean; readonly onSubmit: (userId: string, roleKeys: readonly string[]) => Promise<void> }) {
  const [open, setOpen] = useState(false); const [userId, setUserId] = useState(''); const [selected, setSelected] = useState<readonly string[]>([]);
  if (!open) return <Button onClick={() => setOpen(true)}><Plus aria-hidden="true" /> افزودن کارمند</Button>;
  const available = availableRoles(roles, canAssignRoles, canAssignOwner);
  return <form className="w-full rounded-lg border border-border bg-card p-4 sm:w-[34rem]" onSubmit={(event) => { event.preventDefault(); if (!isUuid(userId) || selected.length === 0) return; void onSubmit(userId, selected).then(() => { setOpen(false); setUserId(''); setSelected([]); }).catch(() => undefined); }}><label className="block text-sm font-medium">شناسه کاربر<input className={inputClass} dir="ltr" onChange={(event) => setUserId(event.target.value)} placeholder="UUID" value={userId} /></label><RoleChoices roles={available} selected={selected} onChange={setSelected} /><div className="mt-3 flex gap-2"><Button disabled={disabled || !isUuid(userId) || selected.length === 0} type="submit">افزودن</Button><Button disabled={disabled} onClick={() => setOpen(false)} type="button" variant="ghost">انصراف</Button></div></form>;
}

function RoleEditor({ member, roles, disabled, canAssignOwner, onCancel, onSubmit }: { readonly member: StaffProfile; readonly roles: readonly StaffRole[]; readonly disabled: boolean; readonly canAssignOwner: boolean; readonly onCancel: () => void; readonly onSubmit: (keys: readonly string[]) => Promise<void> }) {
  const actor = useAdminSession(); const [selected, setSelected] = useState<readonly string[]>(member.roles); const [confirming, setConfirming] = useState(false);
  const available = availableRoles(roles, hasPermission(actor.permissions, 'staff.assign_roles'), canAssignOwner);
  return <div className="mt-4 border-t border-border pt-4"><RoleChoices roles={available} selected={selected} onChange={setSelected} />{!confirming ? <div className="mt-3 flex gap-2"><Button disabled={disabled} onClick={() => setConfirming(true)} type="button">ثبت نقش‌ها</Button><Button disabled={disabled} onClick={onCancel} type="button" variant="ghost">انصراف</Button></div> : <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-amber-500/10 p-3 text-sm"><span>نقش‌های فعلی به‌طور کامل جایگزین می‌شوند.</span><Button disabled={disabled} onClick={() => { void onSubmit(selected).catch(() => undefined); }} size="sm">تأیید جایگزینی</Button><Button disabled={disabled} onClick={() => setConfirming(false)} size="sm" variant="ghost">انصراف</Button></div>}</div>;
}

function RoleChoices({ roles, selected, onChange }: { readonly roles: readonly StaffRole[]; readonly selected: readonly string[]; readonly onChange: (keys: readonly string[]) => void }) {
  if (!roles.length) return <p className="mt-3 text-sm text-muted-foreground">هیچ نقش قابل‌انتسابی برای این حساب در دسترس نیست.</p>;
  return <fieldset className="mt-3"><legend className="text-sm font-medium">نقش‌ها</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{roles.map((role) => { const checked = selected.includes(role.key); return <label className="flex gap-2 rounded-md border border-border p-2 text-sm" key={role.key}><input checked={checked} onChange={() => onChange(checked ? selected.filter((key) => key !== role.key) : [...selected, role.key])} type="checkbox" /><span><bdi dir="ltr">{role.name}</bdi><span className="mt-0.5 block text-xs text-muted-foreground">{role.description}</span></span></label>; })}</div></fieldset>;
}

function availableRoles(roles: readonly StaffRole[], canAssignRoles: boolean, canAssignOwner: boolean) { return roles.filter((role) => role.key === 'owner' ? canAssignOwner : canAssignRoles); }
function ConfirmedAction({ disabled, label, onConfirm }: { readonly disabled: boolean; readonly label: string; readonly onConfirm: () => Promise<void> }) { const [open, setOpen] = useState(false); if (!open) return <Button className="text-destructive" disabled={disabled} onClick={() => setOpen(true)} size="sm" variant="ghost">{label}</Button>; return <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-2 text-sm"><span>{label}؟</span><Button disabled={disabled} onClick={() => { void onConfirm().then(() => setOpen(false)).catch(() => undefined); }} size="sm">تأیید</Button><Button disabled={disabled} onClick={() => setOpen(false)} size="sm" variant="ghost">انصراف</Button></div>; }
function Status({ status }: { readonly status: StaffProfile['status'] }) { return <span className={status === 'active' ? 'rounded-full bg-emerald-700/10 px-2 py-0.5 text-xs text-emerald-800' : 'rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground'}>{status === 'active' ? 'فعال' : 'معلق'}</span>; }
function Empty() { return <section className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center"><UserRoundCog aria-hidden="true" className="size-8 text-muted-foreground" /><h2 className="mt-3 font-semibold">کارمندی ثبت نشده است</h2><p className="mt-1 text-sm text-muted-foreground">برای افزودن کارمند، شناسه کاربر موجود را وارد کنید.</p></section>; }
function Loading() { return <main aria-busy="true" className="mx-auto max-w-6xl space-y-4" dir="rtl"><div className="h-9 w-48 animate-pulse rounded bg-muted" />{Array.from({ length: 3 }, (_, index) => <div className="h-36 animate-pulse rounded-lg bg-muted" key={index} />)}</main>; }
function Failure({ error, onRetry }: { readonly error: unknown; readonly onRetry: () => void }) { return <main className="mx-auto max-w-xl rounded-lg border border-destructive/25 bg-card p-5" dir="rtl" role="alert"><h1 className="font-semibold">فهرست کارکنان دریافت نشد</h1><p className="mt-2 text-sm text-muted-foreground">{message(error)}</p><Button className="mt-4" onClick={onRetry} variant="outline"><RefreshCw aria-hidden="true" /> تلاش دوباره</Button></main>; }
function Problem({ error }: { readonly error: unknown }) { return <div className="rounded-lg border border-destructive/25 px-4 py-3 text-sm" role="alert">{message(error)}</div>; }
function message(error: unknown) { if (isAdminApiError(error) && error.problem.kind === 'api') { if (error.problem.status === 403) return 'اجازه انجام این عملیات را ندارید. اطلاعات از سرویس تازه‌سازی شد.'; if (error.problem.status === 409) return 'این تغییر با وضعیت فعلی سازگار نیست. اطلاعات تازه‌سازی شد.'; if (error.problem.status === 404) return 'کاربر یا نقش موردنظر یافت نشد.'; } return 'پاسخ معتبری از سرویس کارکنان دریافت نشد. دوباره تلاش کنید.'; }
function isUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim()); }
const inputClass = 'mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';
