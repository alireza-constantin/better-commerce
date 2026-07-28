import type {
  StorefrontCheckoutInput,
  StorefrontSessionSnapshot,
} from '@better-commerce/storefront-core/browser';
import { createStorefrontBrowser } from '@better-commerce/storefront-core/browser';

const storefront = createStorefrontBrowser({
  baseUrl: 'https://shop.example.test',
});

const unsubscribe = storefront.session.subscribe(
  (snapshot: StorefrontSessionSnapshot) => void snapshot,
);

const checkout: StorefrontCheckoutInput = {
  lines: [
    {
      variantId: '78dbb65f-0d82-4c9f-86f5-182d58734acb',
      quantity: 1,
    },
  ],
  shippingMethodId: '8181dfd8-0d0a-40e5-926d-2e5a13b65abd',
  paymentMethod: 'cash_on_delivery',
  deliveryAddress: {
    recipientName: 'Test customer',
    phone: '09120000000',
    country: 'IR',
    city: 'Tehran',
    line1: 'Test address',
    postalCode: '1234567890',
  },
};

const submission = storefront.checkout.createSubmission(checkout);
void submission.idempotencyKey;
void storefront.session.getCurrentCustomer();
void storefront.orders.list({ limit: 10 });
unsubscribe();
