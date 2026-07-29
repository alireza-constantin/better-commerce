export interface CartOwner {
  readonly userId?: string;
  readonly anonymousTokenDigest?: string;
  readonly anonymousTokenDigests?: readonly string[];
}

export interface CartLineView {
  readonly id: string;
  readonly variantId: string;
  readonly quantity: number;
  readonly productTitle: string | null;
  readonly variantTitle: string | null;
  readonly price: { readonly amount: string; readonly currency: string } | null;
  readonly availability: 'in_stock' | 'out_of_stock' | 'unavailable';
  readonly purchasable: boolean;
}

export interface CartView {
  readonly id: string | null;
  readonly version: number;
  readonly status: 'active';
  readonly expiresAt: Date | null;
  readonly lines: readonly CartLineView[];
}

export interface CheckoutCart {
  readonly cartId: string;
  readonly version: number;
  readonly lines: readonly { variantId: string; quantity: number }[];
}
