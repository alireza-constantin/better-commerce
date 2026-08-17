# PRD — Phase 8 Customers, Wishlists, and Customer Communications

Status: Approved
Date: 2026-08-17
Architectural authority:
[ADR-0019](../adr/0019-customers-wishlists-and-communications.md)

## Summary

Phase 8 gives a merchant one coherent Customer workspace and gives Customers a
required mobile-first account, a private Wishlist, and reliable SMS
communications. Staff can find activated Customers, understand their commerce
history, send a direct message, operate versioned transactional templates, and
create scheduled promotional Campaigns. External SMS delivery remains durable,
auditable, and replaceable per store and message purpose.

The release is designed for a non-technical Persian-speaking store employee.
Admin remains RTL-first, responsive, calm, and professional. Technical IDs,
provider diagnostics, and raw infrastructure failures stay out of primary
workflows.

## Problem

The current platform has authenticated Users and Order snapshots but no
reusable Customer Profile or staff Customer directory. Registration requires
email, has no mobile identity, and cannot offer mobile OTP login. Customers
cannot save Variants for later or request an availability alert. Staff cannot
send one Customer a message, operate transactional SMS, or create a mass
Campaign. Provider calls also lack the durable queue and normalized adapter
boundary required for safe delivery during outages.

## Goals

Phase 8 must:

1. require and verify one Iranian mobile number for every newly registered
   Customer;
2. support mobile OTP login and optional verified email/password login;
3. create one Customer Profile during registration and activate it with the
   User;
4. provide a searchable, permission-aware Customer directory and detail
   workspace;
5. provide a private, cross-device Variant Wishlist;
6. create one-time Wishlist availability alerts from authoritative commerce
   state;
7. send durable authentication, transactional, direct, promotional, and
   Wishlist SMS;
8. let each store select a configured provider independently for each message
   purpose;
9. preserve immutable Campaign, Message, attempt, actor, and delivery history;
10. keep commerce operations successful when non-authentication SMS providers
    are unavailable.

## Non-goals

Phase 8 does not include:

- international registration numbers;
- mobile-number replacement or staff mobile editing;
- account recovery when the mobile is lost and no verified email exists;
- staff account mutation or password reset from Customer screens;
- anonymous or shareable Wishlists;
- raw phone-number imports;
- arbitrary segment expressions, fuzzy search, or a search service;
- shipment messages before Fulfillment owns Shipment events;
- editing provider credentials inside Admin;
- automatic cross-provider resend after an uncertain result;
- a general marketing automation or workflow builder;
- the deferred behavior for an existing Customer who later becomes staff.

## Users

### Customer

A registered shopper who owns a verified mobile login, Customer Profile,
Orders, Wishlist, and customer-facing communication history.

### Support employee

A staff member who finds a Customer, reviews permitted Order/Wishlist/message
details, and sends a confirmed one-recipient message.

### Marketing employee

A staff member who builds explainable Customer segments, manages templates,
previews audiences and SMS units, and confirms or schedules Campaigns.

### Administrator or owner

A staff member who configures which already-deployed provider serves each
message purpose and can inspect operational delivery failures.

## Product principles

- A verified login mobile is not an Order delivery phone.
- Staff work with Customers, not authentication rows or raw database Users.
- Every amount, count, status, and delivery outcome comes from an authoritative
  server response.
- Message sending is explicit, confirmed, and visible in history.
- A Provider outage produces a recoverable operational state, not lost work.
- Saved Customer intent remains visible when a Variant becomes unavailable.
- Primary Admin copy is human-readable Persian; technical values use explicit
  LTR detail regions.

## Core journeys

### 1. Register and activate an account

1. The Customer enters a display name, Iranian mobile number, and optionally an
   email and password.
2. The storefront normalizes and confirms the mobile format before submission.
3. The API creates a pending User and Customer Profile and sends an OTP.
4. The Customer enters the six-digit OTP.
5. Successful confirmation activates User and Customer Profile atomically and
   creates a session.
6. If an email was supplied, the Customer verifies it separately before using
   email/password login.

The UI never reveals whether a mobile or email belongs to another account. OTP
errors state what the Customer can do next: wait, resend, or restart.

### 2. Log in

The login page offers two clearly separated methods:

- mobile number followed by OTP;
- verified email and password.

Mobile OTP request and confirmation use resend cooldown, attempt limits, and
abuse protection. Changing methods does not discard a valid pending challenge
until it expires or is replaced.

### 3. Find and understand a Customer

Staff opens Customers from the Admin navigation and can search by exact mobile,
exact email, or display-name prefix. Filters use URL state and survive refresh.
The list shows name, masked mobile, optional email, account state, registration
date, last Order, Order count, completed-Order value, Wishlist count, and last
communication status.

The Customer workspace uses URL-backed tabs:

- Overview;
- Orders;
- Wishlist;
- Messages;
- Account activity.

Each tab loads independently and exposes only permitted data. Staff cannot edit
credentials, mobile, email, password, or account state from this workspace.

### 4. Save and revisit a Variant

An authenticated Customer can save or remove the selected Variant from Product
cards and Product detail. The Wishlist page shows current Product media,
Variant label, Price state, Inventory availability, and the correct action:

- Add to Cart when purchasable;
- contact the merchant when price-on-request;
- request an availability alert when unavailable;
- an explanation when archived.

Wishlist state is shared across the Customer's devices. Duplicate saves and
repeated removals do not create errors.

### 5. Request an availability alert

The Customer explicitly enables “notify me” for one unavailable saved Variant.
When Catalog, Pricing, or Inventory changes, the platform rechecks the complete
authoritative purchasability state. It creates one alert when the Variant first
becomes purchasable and does not repeat until a later unavailable episode.

### 6. Send one Customer a message

Authorized staff starts from Customer detail, enters a purpose and message,
reviews character/segment count and estimated units, sends a restricted test if
needed, and confirms. The UI displays the server-confirmed queued result. Later
delivery updates appear in the Customer's Messages tab.

### 7. Operate transactional templates

Authorized staff views built-in Order message purposes, edits a new immutable
template version, inserts only allowlisted variables, previews representative
data, sends a restricted test, and activates the version. Historical Messages
retain the exact prior version and rendered text.

### 8. Build and send a Campaign

1. Staff creates a draft Campaign.
2. Staff writes or selects a template and optionally attaches a Promotion.
3. Staff selects individual Customers, all messageable Customers, or a saved
   segment.
4. Admin previews the current audience, exclusions, encoding, SMS segments, and
   estimated total units.
5. Staff chooses immediate delivery or a Tehran-time schedule.
6. Final confirmation freezes the message, Promotion version, Provider route,
   and audience.
7. Admin shows queued, accepted, delivered, failed, unknown, and stopped
   results.

A confirmed Campaign is never edited. Staff may cancel remaining work and
duplicate the Campaign into a new draft.

A messageable Customer is activated, is not disabled, has a verified login
mobile, and is not an active staff member. This definition is evaluated before
audience confirmation and again before a queued Message intent is claimed.

### 9. Switch a Provider route

An administrator selects one configured provider for authentication,
transactional/direct, Campaign, or Wishlist delivery. Admin requires a healthy
adapter and successful test message, explains the affected purpose, and asks
for confirmation. New Message intents use the new route. Existing intents keep
their original provider.

## Functional requirements

### Identity and Customer activation

| ID    | Requirement                                                                                                                                                                                                                |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ID-01 | Registration requires display name and a valid Iranian mobile number.                                                                                                                                                      |
| ID-02 | Email is optional; password is required exactly when email is supplied.                                                                                                                                                    |
| ID-03 | Mobile numbers accept local Iranian display form and persist in normalized E.164 form.                                                                                                                                     |
| ID-04 | A normalized mobile number identifies at most one non-expired registration/User.                                                                                                                                           |
| ID-05 | Registration creates pending User and Customer Profile atomically.                                                                                                                                                         |
| ID-06 | Pending registrations cannot authenticate or use Customer resources.                                                                                                                                                       |
| ID-07 | OTP uses six digits, five-minute expiry, five attempts, sixty-second resend cooldown, and hourly mobile/IP limits.                                                                                                         |
| ID-08 | Only a keyed OTP hash is stored; a new challenge invalidates older active challenges.                                                                                                                                      |
| ID-09 | OTP confirmation activates User and Customer Profile atomically.                                                                                                                                                           |
| ID-10 | Mobile OTP login is available to every activated Customer.                                                                                                                                                                 |
| ID-11 | Email/password login is available only after that email is verified.                                                                                                                                                       |
| ID-12 | Customers may edit display name and add/verify email; mobile remains immutable.                                                                                                                                            |
| ID-13 | Pending registrations expire after 24 hours and support bounded cleanup.                                                                                                                                                   |
| ID-14 | Existing accounts enter a mobile-enrollment-required transition; customer operations remain restricted until verification, while an operational bootstrap path lets the owner configure the authentication Provider route. |

### Customer directory

| ID    | Requirement                                                                                                                      |
| ----- | -------------------------------------------------------------------------------------------------------------------------------- |
| CU-01 | Directory reads require `customers.read` and exclude pending registrations.                                                      |
| CU-02 | The default list uses newest-registration-first cursor pagination.                                                               |
| CU-03 | Search supports exact normalized mobile, exact normalized email, and display-name prefix.                                        |
| CU-04 | Filters support account status and registration-date range in URL state.                                                         |
| CU-05 | List results contain the approved summary columns and mask mobile values.                                                        |
| CU-06 | Completed-Order value is the exact configured-currency sum of Orders currently in completed state; it is not browser-calculated. |
| CU-07 | Detail tabs load through separate typed queries and enforce their own permissions.                                               |
| CU-08 | Staff Customer screens do not expose password hashes, OTP values, sessions, provider secrets, or raw infrastructure diagnostics. |
| CU-09 | CSV exports are audited and mask mobile unless the actor also has `customers.read`.                                              |

### Wishlist

| ID    | Requirement                                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------ |
| WI-01 | Wishlist requires an authenticated activated Customer.                                                       |
| WI-02 | A Customer may save at most 200 unique Variant IDs.                                                          |
| WI-03 | Save and remove commands are idempotent.                                                                     |
| WI-04 | Reads preserve saved items that are inactive, archived, unavailable, or price-on-request.                    |
| WI-05 | Current Price and availability are composed from authoritative module contracts or read projections.         |
| WI-06 | Exact staff Wishlist detail requires `customers.wishlists.read` and creates a safe audit fact.               |
| WI-07 | One availability request may be enabled per saved Variant.                                                   |
| WI-08 | Alert creation rechecks Product publication, Variant activity, current Price, and Inventory availability.    |
| WI-09 | One unavailable episode produces at most one alert; a new episode begins only after observed unavailability. |
| WI-10 | Normal-operation alert intent creation targets one minute after the authoritative change.                    |

### Templates and Message intents

| ID    | Requirement                                                                                                                                         |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| MS-01 | Message purposes route independently through configured adapters.                                                                                   |
| MS-02 | Templates are immutable versions with purpose-specific allowlisted variables.                                                                       |
| MS-03 | Ordinary Message intents snapshot rendered text, template version, Customer, destination, purpose, actor/trigger, provider binding, and timestamps. |
| MS-04 | Authentication payloads use short-lived encrypted work storage and do not appear in staff message history.                                          |
| MS-05 | Message creation and the triggering business change are atomic where loss would violate the workflow.                                               |
| MS-06 | Delivery attempts are append-only and normalize accepted, delivered, failed, or unknown outcomes.                                                   |
| MS-07 | Safe transient failures retry with bounded exponential backoff.                                                                                     |
| MS-08 | Accepted, delivered, or unknown submissions never automatically resend.                                                                             |
| MS-09 | Provider callbacks are authenticated, replay-protected, idempotent, and monotonic.                                                                  |
| MS-10 | Provider outages never roll back Order state changes.                                                                                               |
| MS-11 | Missing authentication delivery makes production readiness fail.                                                                                    |
| MS-12 | Missing non-authentication routes disable affected actions with non-technical recovery copy.                                                        |

### Direct messages and Campaigns

| ID    | Requirement                                                                                               |
| ----- | --------------------------------------------------------------------------------------------------------- |
| CA-01 | A Direct message requires purpose, preview, estimate, confirmation, and `communications.send`.            |
| CA-02 | Test messages go only to the current staff member's verified mobile or a configured test number.          |
| CA-03 | Saved segments support only the approved AND-combined filters.                                            |
| CA-04 | Segment preview is current; confirmed Campaign audience rows are immutable.                               |
| CA-05 | A Campaign supports at most 50,000 recipients and four SMS segments per recipient, configurable downward. |
| CA-06 | Campaign state follows draft, scheduled, sending, completed, or cancelled.                                |
| CA-07 | Confirmation freezes content, template, Promotion version, Provider route, audience, and actor.           |
| CA-08 | Cancellation stops unclaimed deliveries and reports already accepted or uncertain work honestly.          |
| CA-09 | Scheduled times use the configured store timezone, defaulting to Asia/Tehran.                             |
| CA-10 | Results expose aggregate and searchable recipient-level outcomes.                                         |
| CA-11 | Completed or cancelled Campaigns may be duplicated but never edited.                                      |
| CA-12 | No endpoint accepts an imported raw phone-number list.                                                    |

### Provider operations

| ID    | Requirement                                                                                                               |
| ----- | ------------------------------------------------------------------------------------------------------------------------- |
| PR-01 | Provider SDKs are reachable only through Customer Communications adapters.                                                |
| PR-02 | Credentials remain in deployment configuration and are redacted from logs and responses.                                  |
| PR-03 | Provider routes are store-level persisted selections of configured adapter keys.                                          |
| PR-04 | A route change requires `communications.configure`, provider health, a successful test, confirmation, and an audit event. |
| PR-05 | Route changes affect only Message intents created after acceptance.                                                       |
| PR-06 | Every adapter passes one conformance suite for submission, normalization, callbacks, errors, timeouts, and idempotency.   |

## Transactional message catalogue

The first release supports these Order facts:

| Fact                     | Customer message purpose                          |
| ------------------------ | ------------------------------------------------- |
| Order submitted          | Confirm receipt and stable Order number           |
| Order accepted           | Confirm merchant acceptance and next step         |
| Order rejected           | Explain rejection using safe customer-facing copy |
| Manual payment confirmed | Confirm recorded payment state                    |
| Order cancelled          | Confirm cancellation state                        |
| Order completed          | Confirm completion                                |

Each fact produces at most one Message intent per Order and purpose. Replaying a
command or consuming an outbox fact more than once cannot duplicate the intent.

## Permissions and role experience

| Permission                 | Capability                                                     |
| -------------------------- | -------------------------------------------------------------- |
| `customers.read`           | Customer directory, profile summaries, and permitted detail    |
| `customers.wishlists.read` | Exact Customer Wishlist items                                  |
| `communications.read`      | Templates, Campaigns, Message history, outcomes, and exports   |
| `communications.write`     | Draft templates, segments, and Campaigns                       |
| `communications.send`      | Test, Direct, immediate, and scheduled sends plus cancellation |
| `communications.configure` | Provider route selection and operational configuration         |

Role names seed explicit permissions but never replace endpoint checks. The
recommended grants follow ADR-0019. A later `403` is handled as lost authority,
not as a hidden or disabled client-only control.

## Admin UX requirements

- Persian language and RTL layout are mandatory.
- Lists use responsive tables on wide screens and task-focused cards on narrow
  screens.
- Customer and Campaign filters live in the URL.
- Full mobile numbers and technical IDs are secondary detail, rendered LTR.
- Every send action shows pending, accepted, and failure states without raw
  provider text.
- High-impact actions use the shared confirmation dialog, not browser-native
  confirmation.
- Forms associate errors with fields and preserve recoverable drafts.
- Cursor pagination never invents page totals.
- Loading, empty, unavailable, partial-result, and stale-authority states have
  specific human-readable copy.
- Keyboard operation, focus restoration, reduced motion, contrast, semantic
  labels, and error association target WCAG 2.2 AA.

## Storefront UX requirements

- Registration and login present mobile OTP as a first-class path.
- OTP entry supports paste, numeric keyboards, resend countdown, correction of
  the mobile number before activation, and clear expiry recovery.
- Wishlist controls expose accessible saved state and do not require a full
  page reload.
- Product UI saves the currently selected Variant.
- Wishlist current-state rendering comes from server results; the browser does
  not calculate purchasability.
- Availability-alert state is explicit and reversible per item.
- Private account, Wishlist, Order, and Message data remains dynamic and
  `private`/`no-store` under ADR-0011.

## Durable processing and recovery

- PostgreSQL is authoritative for outbox facts, Message intents, Campaign
  audiences, attempts, leases, and audit history.
- Worker claims use bounded batches, lease expiry, and crash-safe reprocessing.
- Consumers deduplicate by stable outbox event ID and intent uniqueness keys.
- Poison facts stop after a bounded attempt count and enter an operator-visible
  failed state without blocking unrelated work.
- Redis loss may slow coordination but cannot erase pending messages.
- API restarts and worker restarts resume queued work.
- An unknown provider result remains visible for staff review and is never
  silently converted into failure or retried through another adapter.

## Retention and observability

- Campaign definitions, aggregate outcomes, and audit history remain
  indefinitely.
- Ordinary rendered message text and Delivery attempts remain for two years by
  default, configurable per deployment.
- Expired OTP payloads are erased promptly.
- Logs contain message/campaign/attempt IDs and normalized outcomes, not mobile
  numbers, rendered text, OTPs, credentials, or provider secrets.
- Metrics cover queue depth, oldest queued age, provider latency, normalized
  outcomes, callback rejection, retry exhaustion, and outbox lag.
- Alerts cover unavailable authentication delivery, growing queue age,
  sustained failures, callback verification failures, and stuck Campaigns.

## Acceptance scenarios

The feature is complete only when automated tests demonstrate:

1. local Iranian formats normalize to one unique E.164 identity;
2. pending registration, expiry, resend, attempt, and abuse limits behave
   atomically under concurrency;
3. activation never leaves only User or Customer Profile active;
4. mobile OTP and verified email/password login work without enumeration;
5. Customer directory masking, search, filtering, pagination, permissions, and
   detail-tab isolation;
6. Wishlist idempotency, 200-item limit, cross-customer isolation, and current
   unavailable states;
7. one availability alert per unavailable episode across duplicate events and
   worker restarts;
8. Order changes commit while a provider is offline and later create exactly
   one Message intent;
9. template version history and rendered snapshots remain unchanged after
   edits;
10. Campaign audience and Promotion version remain frozen after confirmation;
11. cancellation, partial sending, retryable failure, unknown outcome, callback
    replay, and Provider switch behavior;
12. OTP and provider secrets never appear in logs, APIs, exports, or ordinary
    message history;
13. Admin desktop/mobile RTL flows and axe checks pass;
14. storefront registration/login/Wishlist flows pass desktop/mobile browser
    tests;
15. OpenAPI, generated SDK, storefront-core, API E2E, production builds, and
    Docker-backed restart/outage checks pass.

## Success measures

- At least 99% of normal OTP Message intents are accepted by the configured
  provider within one minute, measured separately from provider delivery.
- No successful Order-state mutation is rolled back because an SMS provider is
  unavailable.
- No duplicate Message intent is created from command replay, outbox replay, or
  callback replay.
- Customer lookup by exact mobile returns within the Admin interaction budget
  at the supported deployment scale.
- A non-technical employee can create, test, review, and schedule a Campaign
  without entering IDs or JSON.
- A Customer can register, verify, log in, save a Variant, and request an alert
  using keyboard-only and mobile layouts.

## Delivery slices

Each slice is independently reviewed, tested, committed, and documented.

1. **Contracts and durable foundation:** ADR/contract test matrix, provider
   adapter contract, configuration, outbox, worker leases, and test adapter.
2. **Mobile Identity and Customer Profile:** schema transition, registration,
   OTP activation/login, optional email/password, enrollment migration, and
   storefront auth UI.
3. **Customer directory:** read projection, search/filter/cursor APIs,
   permissions, Persian Admin list/detail shell, Orders and activity tabs.
4. **Wishlist:** API, SDK/storefront-core, storefront controls/page, Admin
   permitted detail, and current-state composition.
5. **Availability alerts:** integration facts, authoritative reevaluation,
   episode deduplication, Message intent, and storefront controls.
6. **Transactional templates and Order messages:** versioning, rendering,
   Order outbox facts, Direct messages, history, and retry operations.
7. **Segments and Campaigns:** saved filters, preview, frozen audiences,
   Promotion linkage, scheduling, batching, cancellation, results, and export.
8. **Provider operations and release verification:** Admin routing, health/test,
   callback conformance, metrics/alerts, retention jobs, browser accessibility,
   outage/restart testing, and living documentation.

## Deferred decisions

- Behavior when an existing Customer later receives or loses a Staff Profile.
- Customer mobile-number replacement and stronger account recovery.
- International mobile registration and multi-country provider routing.
- Shipment messages and Fulfillment templates.
- Anonymous or shared Wishlists.
- Advanced segment operators, OR groups, recurring Campaigns, and a search
  service.
