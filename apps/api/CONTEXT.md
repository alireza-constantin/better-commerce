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

## Customers and communications

**Customer profile**:
A commerce profile created for each registered User and identified by that
User's ID; it owns reusable customer contact and preference facts rather than
authentication credentials.
_Avoid_: User account, staff profile, order recipient

**Login mobile number**:
The Customer's required, verified, Identity-owned mobile number that may be
used for authentication and as the Customer's SMS destination.
_Avoid_: Delivery phone, staff-entered phone, unverified contact number

**Wishlist**:
A Customer's private set of saved Variants, retaining unavailable entries so
the Customer's intent and related availability alerts are not silently lost.
_Avoid_: Saved Cart, Product collection, staff-curated list

**Message intent**:
A durable request to deliver one specific communication to one Customer,
committed independently of an external provider's availability.
_Avoid_: Sent message, provider request, background callback

**Delivery attempt**:
One auditable attempt to hand a Message intent to its bound delivery provider,
with a normalized outcome and private provider reference.
_Avoid_: Message, retry counter, campaign recipient

**Wishlist availability alert**:
A Customer-requested one-time Message intent created when a saved Variant
transitions from not purchasable to purchasable.
_Avoid_: Promotion campaign, repeated stock notification, inventory truth

**Customer segment**:
A saved, explainable set of bounded Customer conditions that can be evaluated
to preview an audience without becoming a frozen recipient list.
_Avoid_: SQL filter, campaign audience, authorization group

**Campaign audience**:
The immutable set of eligible Customer recipients captured when a Campaign is
confirmed or scheduled.
_Avoid_: Customer segment, live query, imported phone list

**SMS campaign**:
A versioned staff-authored promotional communication whose confirmed audience
produces independently tracked Message intents.
_Avoid_: Promotion, transactional template, bulk provider request

**Message template**:
A versioned, purpose-specific text definition whose allowlisted variables are
rendered and snapshotted for each Message intent.
_Avoid_: Free-form code, provider template, mutable sent message

**Pending registration**:
An Identity-owned, non-authenticating User state that temporarily reserves a
mobile number while its registration OTP awaits verification.
_Avoid_: Active customer, anonymous session, disabled account

**Provider route**:
The store-level selection of one configured SMS provider for one Message
purpose, applied when a new Message intent is created.
_Avoid_: Automatic failover, provider secret, per-domain SMS client

**Unknown delivery**:
A Delivery attempt whose provider acceptance cannot be proven or disproven and
therefore must not be retried automatically.
_Avoid_: Failed delivery, queued message, safe retry

**Direct message**:
A one-recipient, staff-authored Message intent created from a Customer profile
with an explicit purpose and staff actor.
_Avoid_: Campaign, support note, provider test message
