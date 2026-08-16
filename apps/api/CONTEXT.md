# Commerce API

The Commerce API owns the authoritative server-side commerce capabilities and
the contracts used by staff and storefront applications.

## Catalog and pricing

**Price on request**:
An active, published Variant with no current Price that remains visible in the
catalog but cannot be added to a normal Cart or Checkout flow. Each storefront
owns the contact experience for this state.
_Avoid_: Free product, zero price, missing-price error

**Untracked inventory**:
An Inventory policy under which a Variant has no quantity constraint; it does
not represent a large or infinite on-hand quantity.
_Avoid_: Infinite stock, 9999 stock

**Variant media assignment**:
An association between a Product media asset and one or more Variants that
determines which Product images represent a Variant.
_Avoid_: Duplicated variant image, variant-owned binary file

**Price withdrawal**:
The deliberate ending of a Variant's current Price, leaving the Variant in the
price-on-request state while retaining every prior Price version.
_Avoid_: Delete price, blank price

**Variant configuration replacement**:
A complete staff-submitted set of a Product's Options, Variants, operational
settings, and media assignments; the most recently accepted replacement is the
current state.
_Avoid_: Partial variant patch, background merge

**Promotion**:
An independently versioned campaign definition that may produce one exact,
auditable merchandise discount during checkout when its eligibility and usage
rules pass.
_Avoid_: Coupon as a mutable price field, sale price, browser discount

**Discount quote**:
Promotions' authoritative, exact result containing the selected promotion,
total discount, and deterministic per-line allocations for a checkout attempt.
_Avoid_: Cart total, displayed discount, client-calculated savings
