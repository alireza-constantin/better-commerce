import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  getRouteApi,
} from '@tanstack/react-router';
import { isAdminApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { adminRoutes } from '@/app/routes/admin-route-contract';
import { PermissionBoundary } from '@/features/auth/permissions/permission-boundary';
import { hasPermission } from '@/features/auth/permissions/permissions';
import { useAdminSession } from '@/features/auth/session/use-admin-session';
import {
  acceptAdminOrderMutationOptions,
  adminOrderDetailQueryOptions,
  adminOrdersListQueryOptions,
  adminOrdersQueryKeys,
  confirmManualPaymentMutationOptions,
  rejectAdminOrderMutationOptions,
} from './api';
import {
  OrderDetail,
  OrdersList,
} from './components';

const ORDERS_PAGE_LIMIT = 25;
const ordersRouteApi = getRouteApi('/orders');
const orderDetailRouteApi = getRouteApi('/orders/$orderId');

export function OrdersRoute() {
  return (
    <PermissionBoundary required={adminRoutes.orders.permissions}>
      <OrdersListRouteContent />
    </PermissionBoundary>
  );
}

function OrdersListRouteContent() {
  const search = ordersRouteApi.useSearch();
  const cursorHistory = search.history ?? [];
  const navigate = ordersRouteApi.useNavigate();
  const orders = useQuery(
    adminOrdersListQueryOptions({
      cursor: search.cursor,
      limit: ORDERS_PAGE_LIMIT,
    }),
  );

  const goToCursor = (
    cursor: string | undefined,
    history: readonly string[],
  ) => {
    void navigate({
      to: adminRoutes.orders.path,
      search: {
        cursor,
        history: [...history],
      },
    });
  };

  return (
    <OrdersList
      error={orders.isError ? queryErrorMessage(orders.error) : undefined}
      hasPreviousPage={cursorHistory.length > 0}
      isFetchingNextPage={orders.isFetching}
      isFetchingPreviousPage={orders.isFetching}
      isLoading={orders.isPending}
      onNextPage={
        orders.data?.nextCursor
          ? () => {
              goToCursor(orders.data.nextCursor ?? undefined, [
                ...cursorHistory,
                search.cursor ?? '',
              ]);
            }
          : undefined
      }
      onOrderSelect={(orderId) => {
        void navigate({
          to: adminRoutes.orderDetail.path,
          params: { orderId },
          search: {
            returnCursor: search.cursor,
            returnHistory: [...cursorHistory],
          },
        });
      }}
      onPreviousPage={() => {
        const history = [...cursorHistory];
        const previousCursor = history.pop();
        goToCursor(previousCursor || undefined, history);
      }}
      onRetry={() => {
        void orders.refetch();
      }}
      page={orders.data}
    />
  );
}

export function OrderDetailRoute() {
  return (
    <PermissionBoundary required={adminRoutes.orderDetail.permissions}>
      <OrderDetailRouteContent />
    </PermissionBoundary>
  );
}

function OrderDetailRouteContent() {
  const routeParams: unknown = orderDetailRouteApi.useParams();
  const orderId =
    routeParams &&
    typeof routeParams === 'object' &&
    'orderId' in routeParams &&
    typeof routeParams.orderId === 'string'
      ? routeParams.orderId
      : '';
  const search = orderDetailRouteApi.useSearch();
  const navigate = orderDetailRouteApi.useNavigate();
  const profile = useAdminSession();
  const queryClient = useQueryClient();
  const order = useQuery(adminOrderDetailQueryOptions(orderId));
  const confirmPayment = useMutation(confirmManualPaymentMutationOptions());
  const acceptOrder = useMutation(acceptAdminOrderMutationOptions());
  const rejectOrder = useMutation(rejectAdminOrderMutationOptions());
  const mutationError =
    confirmPayment.error ?? acceptOrder.error ?? rejectOrder.error;

  const refreshOrders = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: adminOrdersQueryKeys.detail(orderId),
      }),
      queryClient.invalidateQueries({
        queryKey: adminOrdersQueryKeys.lists(),
      }),
    ]);
  };

  if (order.isPending) {
    return <OrderDetailLoading />;
  }

  if (order.isError) {
    return (
      <OrderDetailError
        message={queryErrorMessage(order.error)}
        onBack={() => {
          void navigate({
            to: adminRoutes.orders.path,
            search: ordersReturnSearch(search),
          });
        }}
        onRetry={() => {
          void order.refetch();
        }}
      />
    );
  }

  const isSubmitted = order.data.status === 'submitted';
  const bankTransferCanBeAccepted =
    order.data.paymentMethod !== 'bank_transfer' ||
    order.data.paymentStatus === 'confirmed';
  const paymentCanBeConfirmed =
    order.data.paymentMethod === 'bank_transfer'
      ? isSubmitted
      : order.data.status === 'accepted';
  const isSubmitting =
    confirmPayment.isPending || acceptOrder.isPending || rejectOrder.isPending;

  return (
    <div className="space-y-4">
      {mutationError ? <OrderMutationError error={mutationError} /> : null}
      <OrderDetail
        actions={{
          onAccept: async (decision) => {
            await acceptOrder.mutateAsync({ orderId, decision });
            await refreshOrders();
          },
          onConfirmPayment: async (confirmation) => {
            await confirmPayment.mutateAsync({ orderId, confirmation });
            await refreshOrders();
          },
          onReject: async (decision) => {
            await rejectOrder.mutateAsync({ orderId, decision });
            await refreshOrders();
          },
        }}
        availability={{
          canAccept:
            isSubmitted &&
            bankTransferCanBeAccepted &&
            hasPermission(profile.permissions, 'orders.accept'),
          canConfirmPayment:
            paymentCanBeConfirmed &&
            !['confirmed', 'rejected', 'cancelled'].includes(
              order.data.paymentStatus,
            ) &&
            hasPermission(profile.permissions, 'payments.manual_confirm'),
          canReject:
            isSubmitted &&
            hasPermission(profile.permissions, 'orders.reject'),
          isSubmitting,
        }}
        onBack={() => {
          void navigate({
            to: adminRoutes.orders.path,
            search: ordersReturnSearch(search),
          });
        }}
        order={order.data}
      />
    </div>
  );
}

function ordersReturnSearch(
  search: {
    readonly returnCursor?: string;
    readonly returnHistory?: readonly string[];
  },
) {
  return {
    cursor: search.returnCursor,
    history: [...(search.returnHistory ?? [])],
  };
}

function queryErrorMessage(error: unknown) {
  if (isAdminApiError(error) && error.problem.kind === 'api') {
    if (error.problem.status === 403) {
      return 'حساب شما اجازه انجام این عملیات را ندارد.';
    }
    if (error.problem.status === 404) {
      return 'سفارش موردنظر پیدا نشد یا دیگر در دسترس نیست.';
    }
    if (error.problem.status === 409) {
      return 'وضعیت سفارش تغییر کرده است. اطلاعات را تازه‌سازی و دوباره بررسی کنید.';
    }
  }

  return 'پاسخ معتبری از سرویس سفارش‌ها دریافت نشد. دوباره تلاش کنید.';
}

function OrderMutationError({ error }: { readonly error: unknown }) {
  const requestId =
    isAdminApiError(error) && 'requestId' in error.problem
      ? error.problem.requestId
      : undefined;

  return (
    <div
      className="rounded-lg border border-destructive/25 bg-card px-4 py-3 text-sm"
      role="alert"
    >
      <p>{queryErrorMessage(error)}</p>
      {requestId ? (
        <p className="mt-1 text-xs text-muted-foreground">
          شناسه درخواست: <bdi dir="ltr">{requestId}</bdi>
        </p>
      ) : null}
    </div>
  );
}

function OrderDetailLoading() {
  return (
    <section
      aria-busy="true"
      aria-label="در حال دریافت جزئیات سفارش"
      className="mx-auto max-w-6xl space-y-5"
    >
      <div className="h-9 w-52 animate-pulse rounded bg-muted" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-80 animate-pulse rounded-lg bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    </section>
  );
}

function OrderDetailError({
  message,
  onBack,
  onRetry,
}: {
  readonly message: string;
  readonly onBack: () => void;
  readonly onRetry: () => void;
}) {
  return (
    <section className="mx-auto max-w-2xl py-12 text-center" role="alert">
      <h1 className="text-xl font-semibold">جزئیات سفارش دریافت نشد</h1>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">{message}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={onRetry}>تلاش دوباره</Button>
        <Button onClick={onBack} variant="outline">
          بازگشت به سفارش‌ها
        </Button>
      </div>
    </section>
  );
}
