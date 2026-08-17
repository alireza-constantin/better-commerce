# ADR-0019 — Customers, Wishlists, and Customer Communications

Status: Accepted
Date: 2026-08-17
Accepted: 2026-08-17
Frozen: 2026-08-17

## Context

Identity currently owns email/password authentication, account status, and
sessions. Orders preserves buyer and delivery snapshots, but those snapshots
are not reusable Customer profiles. The platform now needs required Iranian
mobile registration, mobile OTP login, a staff Customer directory, private
Wishlists, customer-requested availability alerts, transactional SMS, direct
staff messages, and promotional SMS Campaigns.

These workflows introduce two hard boundaries. A delivery phone on an Order may
belong to somebody other than the account holder and cannot become an
authentication identifier. External SMS delivery also cannot participate in a
database transaction: Orders and account activation must remain correct while
a provider is unavailable. This ADR defines capability ownership, durable
delivery, and replaceable provider integration before implementation.

## Decision

The API adds three focused business capabilities—Customers, Wishlist, and
Customer Communications—while Identity remains the sole authority for login
identifiers and OTP verification. A PostgreSQL transactional outbox and durable
worker provide at-least-once integration-fact handling and asynchronous message
delivery. Domain modules never call an SMS provider directly.

### Capability ownership

| Capability                  | Sole authority                                                                                                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity                    | Required normalized mobile identifier, mobile verification, OTP challenges, optional verified email, password credentials, User status, sessions, and authentication abuse controls |
| Customers                   | Customer Profile, display name, activation state, and customer-facing profile history                                                                                               |
| Wishlist                    | One Customer's private saved Variants and per-item availability-alert request state                                                                                                 |
| Customer Communications     | Message templates, direct messages, Campaigns, frozen audiences, Message intents, Delivery attempts, provider routes, normalized delivery outcomes, and communication history       |
| Orders                      | Order lifecycle and immutable buyer, delivery, payment, and commercial snapshots                                                                                                    |
| Catalog, Pricing, Inventory | Their existing authoritative facts used to determine whether a wished-for Variant is currently purchasable                                                                          |

Capabilities exchange stable identifiers and purpose-specific facts through
Module Public Contracts. They do not import another capability's entities,
repositories, DTOs, or provider SDKs.

### Identity and registration

Customer registration requires:

- a display name;
- one Iranian mobile number, accepted in local form and normalized to E.164
  `+98...` form;
- an optional email address;
- a password only when an email is supplied.

Normalized mobile numbers are globally unique per deployment. Registration
creates a `pending_verification` User and a pending Customer Profile in one
explicit cross-module PostgreSQL transaction. Pending accounts cannot create a
session or use customer resources. They reserve the mobile number for 24 hours
and may then be cleaned up through a bounded job.

The registration OTP is a six-digit value with a five-minute lifetime, at most
five confirmation attempts, a sixty-second resend cooldown, and bounded hourly
issuance by normalized mobile number and source IP. Only a keyed hash is stored
as Identity state. Issuing a new OTP invalidates earlier active challenges.
Codes, raw delivery credentials, and session material never enter logs or
ordinary communication history.

Confirming the OTP activates the User and Customer Profile atomically. The
Customer can then authenticate by mobile OTP. When an optional email is
verified, email/password login is also available. An unverified email never
authorizes password login.

The verified mobile number is immutable in version 1. Staff cannot replace it.
Account recovery for a Customer who loses the mobile number and has no verified
email is explicitly deferred.

### Customer Profile and directory

Every activated registration has exactly one Customer Profile keyed by the
Identity User ID. Customers may edit their display name and add and verify an
optional email through Identity's public workflow. Staff Customer screens are
read-only except for separately authorized communication actions.

The Admin Customer directory uses a purpose-specific read projection across
Identity, Customers, Orders, Wishlist, and Customer Communications. It may show
the Customer name, masked mobile, optional email, account status, registration
date, last Order date, Order count, completed-Order value, Wishlist count, and
last communication outcome. The projection is not a write model or source of
truth.

Activated Customers appear under newest-registration-first cursor pagination.
The first search contract supports exact normalized mobile, exact normalized
email, display-name prefix, account status, and registration-date range.
Pending registrations do not appear. Active staff are excluded from the normal
directory; behavior when an existing Customer later becomes staff remains
deferred.

### Wishlist

A Wishlist is private to one authenticated Customer and contains at most 200
unique Variant IDs. Add and remove operations are idempotent. There is no
anonymous Wishlist and no automatic merge with Cart.

Wishlist retains a saved item when its Variant becomes inactive, archived,
out of stock, or price-on-request. The storefront displays the current
authoritative state and permits Add to Cart only when the current Cart rules
allow it. Wishlist never copies current Price, Inventory, or Catalog truth into
an authoritative local value.

A Customer may request one availability alert per saved Variant. An alert
becomes eligible when the Variant transitions from not purchasable to
purchasable: the Variant is active, its Product is published, a current Price
exists, and Inventory is untracked or currently available. Customer
Communications creates at most one alert Message intent for an unavailable
episode. Eligibility resets only after the Variant becomes unavailable again.

Catalog, Pricing, and Inventory publish bounded, non-sensitive change facts to
the transactional outbox. The Wishlist consumer re-reads authoritative facts
before changing observed availability or requesting an alert. Normal-operation
alert creation targets one minute from the authoritative change.

### Message purposes and templates

Customer Communications supports four provider routes:

- authentication OTP;
- transactional Order messages and direct staff messages;
- promotional Campaigns;
- Wishlist availability alerts.

Order transactional messages initially cover Order submitted, accepted,
rejected, manually confirmed payment, cancelled, and completed facts. Shipment
messages wait for an authoritative Fulfillment workflow.

Transactional templates are versioned, use an allowlisted variable set, and
support preview and restricted test delivery. Every ordinary Message intent
snapshots its rendered text and template version. Authentication payloads are
short-lived encrypted work data, are erased after acceptance or expiry, and do
not appear as rendered text in staff history.

A Direct message is staff-authored for one Customer and requires a purpose,
segment/cost preview, and final confirmation. A promotional Campaign may
optionally reference an immutable Promotion definition version and insert
allowlisted Promotion facts into its message.

### Campaigns and audiences

A Campaign follows `draft`, `scheduled`, `sending`, `completed`, or `cancelled`
state. Confirming or scheduling freezes:

- rendered message definition and template version;
- optional Promotion definition version;
- selected Provider route;
- immutable eligible Customer audience;
- staff actor and confirmation instant.

Saved Customer segments remain explainable, bounded queries rather than an
arbitrary expression language. Version 1 supports AND combinations of
registration date, ordered/never ordered, last Order date, completed Order
count/value, purchased Variant/Category/Collection, and Wishlist
Variant/Category/Collection. Segment preview is dynamic; a confirmed Campaign
audience is immutable. No raw phone-list import is accepted.

One Campaign supports at most 50,000 recipients and four SMS segments per
recipient, both configurable downward per deployment. The Admin preview shows
characters, encoding, per-recipient SMS segments, recipient count, exclusions,
and estimated SMS units. Provider billing remains authoritative.

Scheduled Campaigns use the configured store timezone, `Asia/Tehran` by
default. A confirmed Campaign cannot be edited; staff cancel and duplicate it
into a new draft. Cancelling a sending Campaign stops unclaimed deliveries but
cannot recall provider-accepted messages. Final results distinguish queued,
accepted, delivered, failed, unknown, and stopped recipients.

### Provider adapters and routes

External provider SDKs exist only behind Customer Communications adapter
interfaces. An adapter accepts the platform Message identity and normalized
Iranian destination, submits the rendered payload, verifies provider callbacks,
and maps provider results to normalized outcomes. Provider-specific references
and diagnostic payloads remain private infrastructure facts.

Provider credentials and API secrets come from deployment configuration and
never from Admin requests or database rows. Admin may select one already
configured adapter for each Provider route after a successful health check and
test message. Route changes are audited and apply only to newly created Message
intents. Existing intents remain bound to their original provider.

A timeout or ambiguous provider response becomes `unknown`; it never triggers
automatic cross-provider failover. Only definitively safe transient failures
retry with bounded exponential backoff. `accepted` and `delivered` outcomes are
never resubmitted. Provider callbacks require signature verification, replay
protection, idempotent state transitions, and monotonic outcome handling.

### Durable work and transactional outbox

External SMS calls never occur inside business database transactions. The
platform introduces one narrow transactional-outbox mechanism governed by
ADR-0003:

1. The owning module commits a past-tense integration fact with its business
   mutation through a transaction-aware platform contract.
2. A worker claims outbox records in bounded batches with retry and lease
   semantics.
3. Consumers are idempotent by stable event identity.
4. Customer Communications creates a unique Message intent for the triggering
   event, purpose, and recipient.
5. A delivery worker binds the intent to the current Provider route, submits
   through the adapter, and appends Delivery attempts.

Orders records communication facts in the same transaction as the Order state
change. Registration/OTP orchestration commits the Identity challenge and the
encrypted authentication Message intent atomically through transaction-aware
Module Public Contracts. Campaign expansion durably creates frozen audience
rows and Message intents in bounded batches before delivery begins.

The first worker may run in the API deployment, but ownership, leases,
idempotency, and configuration must permit moving it to a separate process
without changing domain contracts. Redis may coordinate rate limits but is not
the durable source of Message intent or delivery history.

### Authorization, privacy, and retention

The following stable permissions are introduced:

- `customers.read`;
- `customers.wishlists.read`;
- `communications.read`;
- `communications.write`;
- `communications.send`;
- `communications.configure`.

Marketing managers receive Customer summaries plus Campaign, template, and
send authority. Support agents receive Customer/Wishlist detail, message
history, and Direct-message authority. Administrators and owners receive all
communication permissions, including Provider routes. Analysts receive only
aggregate reporting. Exact permissions, rather than role-name checks, protect
every route and action.

The pre-existing `customers.update` permission remains reserved and grants no
Customer Profile, credential, email, mobile, or account-state mutation in this
version. Campaign confirmation requires both `communications.write` and
`communications.send`; Direct messages require `customers.read` and
`communications.send`.

Customer lists mask mobile numbers. Full contact visibility, recipient-level
history, Wishlist detail, Direct messages, provider-route changes, test sends,
Campaign confirmation/cancellation, and CSV exports are independently
authorized and audited. Exports mask mobile numbers unless the actor also has
`customers.read`.

Campaign definitions, aggregate results, and audit facts are retained
indefinitely. Rendered ordinary message bodies and provider-attempt details are
retained for two years by default and may be configured per deployment.
Expired authentication payloads are erased promptly while safe security-event
metadata remains.

Production readiness fails when the authentication Provider route is missing
or unhealthy because registration and mobile login depend on it. Other route
failures disable their Admin actions visibly but do not stop Catalog, Cart,
Checkout, Orders, or account authentication.

## Explicit non-goals

Version 1 does not introduce:

- international mobile-number registration;
- customer or staff mobile-number replacement;
- staff password reset or account-state mutation;
- anonymous Wishlists, shareable Wishlists, or Wishlist-to-Cart merging;
- raw phone-list import;
- arbitrary segment expressions, fuzzy Customer search, or a search cluster;
- Shipment SMS before Fulfillment owns Shipment events;
- automatic provider failover after an ambiguous submission;
- provider credentials stored or edited through Admin;
- editing a confirmed Campaign or historical Message;
- a general workflow engine or general-purpose event bus.

## Alternatives considered

### Store mobile numbers in Customer Profile

Rejected because the required mobile number is an authentication identifier.
Identity must own uniqueness, verification, login, and abuse protection.

### Reuse an Order delivery phone

Rejected because it is an immutable delivery snapshot and may identify a
recipient other than the authenticated Customer.

### Call an SMS provider from Orders, Wishlist, or Identity

Rejected because it couples domain modules to provider models and would make
provider availability part of business transaction correctness.

### Use Redis as the message queue and history

Rejected because Message intent, Campaign audiences, retries, and audit history
must survive Redis loss and process restarts.

### Automatically fail over every provider error

Rejected because an ambiguous timeout may follow successful provider
acceptance; resubmission through another provider can duplicate a message.

### Store Product IDs in Wishlist

Rejected because Variant is already the purchasable identity used by Price,
Inventory, Cart, and Order lines.

## Consequences

### Positive

- Authentication mobile numbers, delivery snapshots, and staff communication
  history have explicit owners.
- Orders and registration remain correct during provider outages.
- Providers can be replaced per purpose without changing domain modules.
- Wishlist alerts react to authoritative purchasability without copying Price
  or Inventory authority.
- Campaign audiences and historical messages remain explainable and auditable.

### Negative

- Registration now requires a cross-module transaction and a production-ready
  authentication SMS route.
- PostgreSQL outbox and worker leasing add operational complexity.
- Provider callbacks and ambiguous outcomes require reconciliation tooling.
- Customer projections join several capabilities and need careful indexing.
- Customers without a verified email have no v1 recovery path after losing
  their mobile number.

## Architectural invariants

An implementation complies with this decision only if:

1. Identity alone mutates login mobile, OTP, email/password, User status, and
   session state.
2. A delivery phone never becomes a Customer login or SMS destination by
   inference.
3. Registration cannot activate only one of User and Customer Profile.
4. Unverified pending registrations cannot authenticate or use customer-owned
   resources.
5. Wishlist references unique Variants and does not own Catalog, Price, or
   Inventory truth.
6. Availability alerts are idempotent and created only after authoritative
   purchasability is rechecked.
7. Domain modules never import or invoke provider SDKs.
8. Every ordinary external delivery originates from a durable Message intent;
   every attempt is append-only and auditable.
9. Provider switching affects only new Message intents.
10. Unknown delivery is never retried automatically or failed over silently.
11. Confirmed Campaign content, audience, Promotion version, and Provider route
    are immutable.
12. External network calls never occur inside a business database transaction.
13. Outbox consumers and provider callbacks are idempotent and safe under
    at-least-once execution.
14. Authentication payloads do not enter ordinary communication history or
    logs and are erased after acceptance or expiry.
15. Admin actions use exact permissions, human-readable Persian UI, explicit
    confirmation, and safe audit facts.

## Acceptance criteria before implementation

The implementation contract and test matrix must define:

1. Iranian number parsing, E.164 normalization, uniqueness, and enumeration-safe
   failures;
2. pending registration, OTP expiry/attempt/resend/rate limits, activation, and
   cleanup;
3. optional email verification and both login paths;
4. Customer directory projection fields, masking, search, cursor behavior, and
   staff exclusion;
5. Wishlist limits, idempotency, unavailable states, and alert edge detection;
6. template variable schemas, rendering, versioning, preview, and test sends;
7. Campaign lifecycle, audience freezing, batching, cancellation, and result
   reconciliation;
8. outbox leasing, poison-message handling, idempotency, and worker recovery;
9. Provider adapter conformance, callbacks, route switching, retry, and unknown
   outcome behavior;
10. message retention, export, redaction, permission, CSRF, and audit behavior;
11. generated SDK, storefront-core, Admin, and storefront workflows;
12. Docker-backed concurrency, restart, outage, accessibility, and responsive
    browser verification.
