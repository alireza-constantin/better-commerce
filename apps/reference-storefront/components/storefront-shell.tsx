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
  StorefrontCheckoutPreparation,
  StorefrontSessionSnapshot,
} from '@better-commerce/storefront-core/browser';
import { storefrontBrowser } from '../lib/storefront-browser';

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
      setMessage(error instanceof Error ? error.message : 'افزودن کالا ممکن نشد.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="cart-action">
      <button type="button" disabled={disabled || busy} onClick={() => void add()}>
        {busy ? 'در حال افزودن…' : 'افزودن به سبد'}
      </button>
      {message ? <small role="status">{message}</small> : null}
    </span>
  );
}

function CartPanel() {
  const { browser, cart, session } = useStorefront();
  const [message, setMessage] = useState('');

  return (
    <aside className="cart-panel" aria-label="سبد خرید">
      <h2>سبد خرید</h2>
      {cart.lines.length ? (
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
}: {
  disabled: boolean;
  onMessage: (value: string) => void;
}) {
  const { browser, cart } = useStorefront();
  const [preparation, setPreparation] =
    useState<StorefrontCheckoutPreparation | null>(null);
  const [shippingMethodId, setShippingMethodId] = useState('');

  async function prepare(form: HTMLFormElement) {
    const data = new FormData(form);
    try {
      const result = await browser.cart.prepareCheckout(addressFrom(data));
      setPreparation(result);
      setShippingMethodId(result.shippingMethods[0]?.methodId ?? '');
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
    if (!cart.id) return;
    const data = new FormData(event.currentTarget);
    try {
      const submission = browser.checkout.createSubmission({
        cartId: cart.id,
        cartVersion: cart.version,
        shippingMethodId,
        paymentMethod: 'cash_on_delivery',
        deliveryAddress: addressFrom(data),
      });
      const order = await submission.submit();
      onMessage(`سفارش شماره ${order.orderNumber} ثبت شد.`);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'ثبت سفارش ممکن نشد.');
    }
  }
  return (
    <form onSubmit={(event) => void submit(event)} className="stack-form">
      <h3>ثبت سفارش</h3>
      <input name="recipientName" placeholder="نام تحویل‌گیرنده" required />
      <input name="phone" placeholder="شماره تماس" required />
      <input name="city" placeholder="شهر" required />
      <input name="line1" placeholder="نشانی" required />
      <input name="postalCode" placeholder="کد پستی" required />
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
                {method.charge.amount === '0.00'
                  ? 'رایگان'
                  : `${method.charge.amount} ${method.charge.currency}`}
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}
      <button type="submit" disabled={disabled || !shippingMethodId}>
        ثبت سفارش با پرداخت نقدی
      </button>
    </form>
  );
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
