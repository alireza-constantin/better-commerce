'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import type {
  StorefrontBrowser,
  StorefrontCart,
  StorefrontCheckoutInput,
  StorefrontCheckoutPreparation,
  StorefrontOrder,
  StorefrontSessionSnapshot,
} from '@better-commerce/storefront-core/browser';
import { storefrontBrowser } from '../lib/storefront-browser';
import { displayMoney } from '../lib/commerce-display';

interface StorefrontContextValue {
  browser: StorefrontBrowser;
  cart: StorefrontCart;
  session: StorefrontSessionSnapshot;
}

const StorefrontContext = createContext<StorefrontContextValue | null>(null);

export function StorefrontShell({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState(storefrontBrowser.cart.getSnapshot());
  const [session, setSession] = useState(
    storefrontBrowser.session.getSnapshot(),
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const unsubscribeCart = storefrontBrowser.cart.subscribe(setCart);
    const unsubscribeSession = storefrontBrowser.session.subscribe(setSession);
    void Promise.all([
      storefrontBrowser.cart.getCurrent(),
      storefrontBrowser.session.getCurrentCustomer(),
    ]);
    return () => {
      unsubscribeCart();
      unsubscribeSession();
    };
  }, []);

  const count = cart.lines.reduce((total, line) => total + line.quantity, 0);

  return (
    <StorefrontContext.Provider
      value={{ browser: storefrontBrowser, cart, session }}
    >
      <header className="site-header">
        <a href="/" className="brand">
          Better Commerce
        </a>
        <button type="button" onClick={() => setOpen((value) => !value)}>
          سبد خرید ({count.toLocaleString('fa-IR')})
        </button>
      </header>
      {open ? <CartPanel /> : null}
      {children}
    </StorefrontContext.Provider>
  );
}

export function AddToCartButton({
  variantId,
  disabled,
}: {
  variantId: string;
  disabled: boolean;
}) {
  const { browser, cart } = useStorefront();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function add() {
    const current =
      cart.lines.find((line) => line.variantId === variantId)?.quantity ?? 0;
    setBusy(true);
    setMessage('');
    try {
      await browser.cart.setQuantity(variantId, current + 1);
      setMessage('به سبد خرید اضافه شد.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'افزودن کالا ممکن نشد.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="cart-action">
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => void add()}
      >
        {busy ? 'در حال افزودن…' : 'افزودن به سبد'}
      </button>
      {message ? <small role="status">{message}</small> : null}
    </span>
  );
}

function CartPanel() {
  const { browser, cart, session } = useStorefront();
  const [message, setMessage] = useState('');
  const [view, setView] = useState<'checkout' | 'orders'>('checkout');

  return (
    <aside className="cart-panel" aria-label="سبد خرید">
      <div className="cart-panel-heading">
        <h2>{view === 'orders' ? 'سفارش‌های من' : 'سبد خرید'}</h2>
        {session.status === 'authenticated' ? (
          <nav aria-label="بخش‌های حساب کاربری" className="cart-panel-nav">
            <button
              type="button"
              className="text-button"
              aria-pressed={view === 'checkout'}
              onClick={() => setView('checkout')}
            >
              خرید
            </button>
            <button
              type="button"
              className="text-button"
              aria-pressed={view === 'orders'}
              onClick={() => setView('orders')}
            >
              سفارش‌ها
            </button>
          </nav>
        ) : null}
      </div>
      {view === 'orders' && session.status === 'authenticated' ? (
        <CustomerOrders />
      ) : cart.lines.length ? (
        <ul>
          {cart.lines.map((line) => (
            <li key={line.id}>
              <span>
                {line.productTitle ?? 'کالا'}
                {line.variantTitle ? ` — ${line.variantTitle}` : ''}
              </span>
              <span>
                {line.price
                  ? `${line.price.amount} ${line.price.currency}`
                  : 'بدون قیمت'}
              </span>
              <label>
                تعداد
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={line.quantity}
                  onChange={(event) =>
                    void browser.cart.setQuantity(
                      line.variantId,
                      Number(event.target.value),
                    )
                  }
                />
              </label>
              <button
                type="button"
                onClick={() => void browser.cart.remove(line.id)}
              >
                حذف
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>سبد خرید شما خالی است.</p>
      )}

      {session.status === 'authenticated' ? (
        <CheckoutForm
          disabled={!cart.id || !cart.lines.length}
          onMessage={setMessage}
          onOrderSubmitted={() => setView('orders')}
        />
      ) : (
        <LoginForm onMessage={setMessage} />
      )}
      {message ? <p role="status">{message}</p> : null}
    </aside>
  );
}

function LoginForm({ onMessage }: { onMessage: (value: string) => void }) {
  const { browser } = useStorefront();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await browser.session.login({
        email: String(data.get('email')),
        password: String(data.get('password')),
      });
      onMessage('ورود انجام شد و سبد خرید شما منتقل شد.');
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'ورود ممکن نشد.');
    }
  }
  return (
    <form onSubmit={(event) => void submit(event)} className="stack-form">
      <h3>ورود برای ادامه خرید</h3>
      <input name="email" type="email" placeholder="ایمیل" required />
      <input name="password" type="password" placeholder="رمز عبور" required />
      <button type="submit">ورود</button>
    </form>
  );
}

function CheckoutForm({
  disabled,
  onMessage,
  onOrderSubmitted,
}: {
  disabled: boolean;
  onMessage: (value: string) => void;
  onOrderSubmitted: () => void;
}) {
  const { browser, cart } = useStorefront();
  const [preparation, setPreparation] =
    useState<StorefrontCheckoutPreparation | null>(null);
  const [shippingMethodId, setShippingMethodId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<
    StorefrontCheckoutInput['paymentMethod'] | null
  >(null);
  const [completedOrder, setCompletedOrder] = useState<StorefrontOrder | null>(
    null,
  );

  useEffect(() => {
    setPreparation(null);
    setShippingMethodId('');
    setPaymentMethod(null);
  }, [cart.version]);

  function invalidatePreparation() {
    setPreparation(null);
    setShippingMethodId('');
    setPaymentMethod(null);
  }

  async function prepare(form: HTMLFormElement) {
    const data = new FormData(form);
    try {
      const result = await browser.cart.prepareCheckout(addressFrom(data));
      setPreparation(result);
      setShippingMethodId(result.shippingMethods[0]?.methodId ?? '');
      setPaymentMethod(result.paymentMethods[0] ?? null);
      if (!result.shippingMethods.length) {
        onMessage('برای این نشانی روش ارسال فعالی پیدا نشد.');
      } else {
        onMessage('روش‌های ارسال به‌روز شد.');
      }
    } catch (error) {
      onMessage(
        error instanceof Error ? error.message : 'محاسبه ارسال ممکن نشد.',
      );
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cart.id || !paymentMethod) return;
    const data = new FormData(event.currentTarget);
    try {
      const submission = browser.checkout.createSubmission({
        cartId: cart.id,
        cartVersion: cart.version,
        shippingMethodId,
        paymentMethod,
        deliveryAddress: addressFrom(data),
      });
      const order = await submission.submit();
      setCompletedOrder(order);
      onMessage('');
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'ثبت سفارش ممکن نشد.');
    }
  }
  if (completedOrder) {
    return (
      <CheckoutConfirmation
        order={completedOrder}
        onOrders={onOrderSubmitted}
      />
    );
  }
  const selectedShipping = preparation?.shippingMethods.find(
    (method) => method.methodId === shippingMethodId,
  );
  const selectedCharge = selectedShipping?.charge;
  const selectedGrandTotal = selectedShipping?.grandTotal;
  return (
    <form onSubmit={(event) => void submit(event)} className="stack-form">
      <h3>ثبت سفارش</h3>
      <input
        name="recipientName"
        placeholder="نام تحویل‌گیرنده"
        required
        onChange={invalidatePreparation}
      />
      <input
        name="phone"
        placeholder="شماره تماس"
        required
        onChange={invalidatePreparation}
      />
      <input
        name="city"
        placeholder="شهر"
        required
        onChange={invalidatePreparation}
      />
      <input
        name="line1"
        placeholder="نشانی"
        required
        onChange={invalidatePreparation}
      />
      <input
        name="postalCode"
        placeholder="کد پستی"
        required
        onChange={invalidatePreparation}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={(event) => {
          const form = event.currentTarget.form;
          if (form?.reportValidity()) void prepare(form);
        }}
      >
        محاسبه روش‌های ارسال
      </button>
      {preparation?.shippingMethods.length ? (
        <fieldset className="shipping-methods">
          <legend>روش ارسال</legend>
          {preparation.shippingMethods.map((method) => (
            <label key={method.methodId}>
              <input
                type="radio"
                name="shippingMethod"
                value={method.methodId}
                checked={shippingMethodId === method.methodId}
                onChange={() => setShippingMethodId(method.methodId)}
              />
              <span>{method.methodTitle}</span>
              <span>
                {method.charge?.amount === '0.00'
                  ? 'رایگان'
                  : displayPreparationMoney(method.charge)}
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}
      {preparation?.paymentMethods.length ? (
        <fieldset className="shipping-methods">
          <legend>روش پرداخت</legend>
          {preparation.paymentMethods.map((method) => (
            <label key={method}>
              <input
                type="radio"
                name="paymentMethod"
                value={method}
                checked={paymentMethod === method}
                onChange={() => setPaymentMethod(method)}
              />
              <span>{paymentMethodLabel(method)}</span>
              <span className="method-note">{paymentMethodNote(method)}</span>
            </label>
          ))}
        </fieldset>
      ) : null}
      {preparation && selectedCharge && selectedGrandTotal ? (
        <dl className="checkout-summary" aria-label="خلاصه مبلغ سفارش">
          <div>
            <dt>جمع کالاها</dt>
            <dd>{displayPreparationMoney(preparation.merchandiseSubtotal)}</dd>
          </div>
          <div>
            <dt>هزینه ارسال</dt>
            <dd>
              {selectedCharge.amount === '0.00'
                ? 'رایگان'
                : displayMoney(selectedCharge)}
            </dd>
          </div>
          <div className="checkout-total">
            <dt>مبلغ قابل پرداخت</dt>
            <dd>{displayMoney(selectedGrandTotal)}</dd>
          </div>
        </dl>
      ) : null}
      <button
        type="submit"
        disabled={disabled || !shippingMethodId || !paymentMethod}
      >
        ثبت نهایی سفارش
      </button>
    </form>
  );
}

function CheckoutConfirmation({
  order,
  onOrders,
}: {
  order: StorefrontOrder;
  onOrders: () => void;
}) {
  return (
    <section
      className="checkout-confirmation"
      aria-labelledby="order-confirmation-title"
    >
      <p className="eyebrow">سفارش ثبت شد</p>
      <h3 id="order-confirmation-title">
        سفارش شماره <bdi dir="ltr">#{order.orderNumber}</bdi>
      </h3>
      <p>{paymentStatusLabel(order.paymentStatus)}</p>
      <p className="confirmation-total">
        {displayMoney({ amount: order.grandTotal, currency: order.currency })}
      </p>
      <button type="button" onClick={onOrders}>
        مشاهده سفارش‌های من
      </button>
    </section>
  );
}

function CustomerOrders() {
  const { browser } = useStorefront();
  const [orders, setOrders] = useState<StorefrontOrder[] | null>(null);
  const [selected, setSelected] = useState<StorefrontOrder | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void browser.orders.list({ limit: 25 }).then(
      (page) => {
        if (active) setOrders([...page.items]);
      },
      (reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : 'دریافت سفارش‌ها ممکن نشد.',
          );
      },
    );
    return () => {
      active = false;
    };
  }, [browser]);

  async function showDetail(orderId: string) {
    setError('');
    try {
      setSelected(await browser.orders.get(orderId));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'دریافت جزئیات سفارش ممکن نشد.',
      );
    }
  }

  if (error) return <p role="alert">{error}</p>;
  if (!orders) return <p aria-busy="true">در حال دریافت سفارش‌ها…</p>;
  if (selected) {
    return (
      <section className="customer-order-detail">
        <button
          type="button"
          className="text-button"
          onClick={() => setSelected(null)}
        >
          بازگشت به سفارش‌ها
        </button>
        <h3>
          سفارش <bdi dir="ltr">#{selected.orderNumber}</bdi>
        </h3>
        <dl className="checkout-summary">
          <div>
            <dt>وضعیت سفارش</dt>
            <dd>{orderStatusLabel(selected.status)}</dd>
          </div>
          <div>
            <dt>وضعیت پرداخت</dt>
            <dd>{paymentStatusLabel(selected.paymentStatus)}</dd>
          </div>
          <div>
            <dt>روش ارسال</dt>
            <dd>{selected.shippingMethodTitle}</dd>
          </div>
          <div className="checkout-total">
            <dt>مبلغ قابل پرداخت</dt>
            <dd>
              {displayMoney({
                amount: selected.grandTotal,
                currency: selected.currency,
              })}
            </dd>
          </div>
        </dl>
      </section>
    );
  }
  if (!orders.length) return <p>هنوز سفارشی ثبت نکرده‌اید.</p>;
  return (
    <ul className="customer-orders">
      {orders.map((order) => (
        <li key={order.id}>
          <span>
            <bdi dir="ltr">#{order.orderNumber}</bdi>
            <small>
              {orderStatusLabel(order.status)} ·{' '}
              {paymentStatusLabel(order.paymentStatus)}
            </small>
          </span>
          <button
            type="button"
            className="text-button"
            onClick={() => void showDetail(order.id)}
          >
            جزئیات
          </button>
        </li>
      ))}
    </ul>
  );
}

function paymentMethodLabel(method: StorefrontCheckoutInput['paymentMethod']) {
  return {
    cash_on_delivery: 'پرداخت هنگام تحویل',
    cash_on_pickup: 'پرداخت هنگام دریافت',
    bank_transfer: 'واریز بانکی',
  }[method];
}

function displayPreparationMoney(
  money: { readonly amount: string; readonly currency: string } | undefined,
) {
  return money ? displayMoney(money) : 'نامشخص';
}

function paymentMethodNote(method: StorefrontCheckoutInput['paymentMethod']) {
  return method === 'bank_transfer'
    ? 'پس از بررسی واریز تأیید می‌شود.'
    : 'پرداخت در زمان دریافت انجام می‌شود.';
}

function paymentStatusLabel(status: StorefrontOrder['paymentStatus']) {
  return {
    pending_manual_review: 'در انتظار بررسی پرداخت',
    pending_collection: 'پرداخت هنگام دریافت',
    confirmed: 'پرداخت تأیید شده',
    rejected: 'پرداخت رد شده',
    cancelled: 'پرداخت لغو شده',
  }[status];
}

function orderStatusLabel(status: StorefrontOrder['status']) {
  return {
    submitted: 'ثبت شده',
    accepted: 'پذیرفته شده',
    cancelled: 'لغو شده',
    completed: 'تکمیل شده',
  }[status];
}

function addressFrom(data: FormData) {
  return {
    recipientName: String(data.get('recipientName')),
    phone: String(data.get('phone')),
    country: 'IR',
    city: String(data.get('city')),
    line1: String(data.get('line1')),
    postalCode: String(data.get('postalCode')),
  };
}

function useStorefront() {
  const value = useContext(StorefrontContext);
  if (!value) throw new Error('StorefrontShell is missing');
  return value;
}
