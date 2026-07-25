# ADR-0013 — Shipping Methods, Zones, and Rate Rules

Status: Accepted
Date: 2026-07-25
Accepted: 2026-07-25
Frozen: 2026-07-25

## Context

The first Checkout supports physical shipment. A merchant must manage delivery
methods and prices in Admin, including free or paid shipping for exact order
subtotal ranges. Shipping must remain independent from Catalog, Pricing,
Inventory, and Orders while Checkout can obtain one exact shipping quote and
Orders can snapshot it historically.

## Decision

Shipping is one API business module. It owns Shipping zones, methods, rate
rules, quote selection, and their lifecycle. It does not own Product price,
stock, Order state, Payment state, or fulfillment execution.

A Zone matches a destination address through an ordered explicit rule set. The
initial address fields are recipient name, phone, country, province/state, city,
address lines, and postal code. A Method belongs to one Zone, has a
merchant-visible title, active/archive state, and deterministic position.

A Rate Rule belongs to a Method and contains an inclusive minimum merchandise
subtotal, optional exclusive maximum merchandise subtotal, and exact Shipping
Money. Zero Money is free shipping. Rules for one Method/currency must never
overlap. The subtotal basis is merchandise after future discounts and before
shipping or tax; until discounts exist it is the exact merchandise subtotal.

This directly supports configurations such as:

```text
1,000,000 <= subtotal < 5,000,000 : free
5,000,000 <= subtotal               : configured price
```

Checkout sends the immutable delivery-address input and merchandise subtotal to
Shipping. Shipping returns eligible Methods and an exact selected quote. The
customer selects one Method. Checkout snapshots the address, Zone/Method/Rule
identifiers, display titles, and exact charge into the submitted Order. Later
Admin edits never rewrite existing Orders.

Initial Admin permissions are `shipping.read` and `shipping.write`. Owner and
Administrator receive both; Order Manager receives `shipping.read`; no other
role receives them unless explicitly granted. Methods/rules are archived, not
hard-deleted after use.

## Initial limits and non-goals

Version 1 supports one selected shipping method, flat subtotal-range prices,
manual Admin configuration, and no overlapping zone/rate ambiguity. It does
not include carrier APIs, live carrier quotes, parcel weight/dimensions,
multiple packages, pickup points, delivery scheduling, tax calculation,
shipping labels, tracking numbers, or fulfillment execution.

## Invariants

1. Shipping alone mutates zones, methods, and rate rules.
2. Every quote is exact Money in the configured store currency.
3. A destination/method/subtotal produces at most one eligible rate.
4. A submitted Order snapshots shipping facts and never recalculates history.
5. Shipping configuration does not mutate Orders, Inventory, or Pricing.
6. Checkout validates a fresh quote; a public shipping estimate is advisory.

