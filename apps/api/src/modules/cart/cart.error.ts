export type CartErrorCode =
  | 'cart.not_found'
  | 'cart.version_conflict'
  | 'cart.limit_exceeded'
  | 'cart.line_invalid'
  | 'cart.merge_conflict'
  | 'cart.checkout_requires_authentication';

export class CartError extends Error {
  constructor(
    readonly code: CartErrorCode,
    message: string,
    readonly currentVersion?: number,
  ) {
    super(message);
  }
}
