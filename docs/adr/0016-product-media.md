# ADR-0016 — Product Media and Asset Delivery

Status: Accepted and frozen  
Date: 2026-07-29

## Context

Products need ordered, accessible images in the Admin and public Catalog.
Binary objects do not belong in PostgreSQL, and storefront presentation must
remain usable from different rendering frameworks. Each merchant deployment is
isolated and owns its database, object store, configuration, and lifecycle.

## Decision

Catalog is the sole authority over Product-media associations and their
metadata. PostgreSQL stores immutable object keys, public delivery URLs,
dimensions, byte size, media type, alt text, and display order. Image bytes are
stored through a platform-owned S3-compatible object-storage boundary.

Version 1 uploads are proxied through the API. The API:

1. accepts one bounded multipart image;
2. decodes the bytes rather than trusting the filename or declared media type;
3. removes embedded metadata, applies orientation, bounds dimensions, and
   normalizes the result to WebP;
4. writes an immutable, generated object key; and
5. commits Catalog metadata with Product optimistic concurrency.

Admin credentials and object-storage credentials are never exposed to the
browser. A deployment may later adopt presigned direct uploads behind a new
contract if traffic or file sizes justify the additional lifecycle.

## Invariants

- A Product owns zero to twenty ordered images.
- Catalog alone creates, reorders, changes alt text, or removes its media rows.
- Object keys are generated; clients cannot select buckets or keys.
- Accepted input is JPEG, PNG, or WebP, at most 10 MiB and 40 megapixels.
- Stored output is WebP, at most 2400 by 2400 pixels, without enlargement.
- Alt text is merchant-authored, trimmed, and limited to 300 characters.
- Ordering is explicit, contiguous, stable, and zero-based.
- Public responses expose delivery URLs and display metadata, never storage
  credentials or internal bucket configuration.
- Stored objects use immutable cache semantics because keys change with bytes.
- Removal deletes authoritative metadata first. Object deletion is idempotent;
  a storage failure is surfaced for retry rather than silently hidden.
- Product version changes for every media mutation.

## Local and production storage

Local development may use a loopback-only MinIO service with disposable
credentials and data. That service is not a production recommendation.
Production uses a maintained managed S3-compatible provider, private write
credentials, a dedicated bucket, HTTPS public delivery (normally a CDN), and
provider lifecycle/backup controls.

## Consequences

Storefronts can render media with native images, a framework image component,
or CDN transformations without importing backend code. The first implementation
creates one normalized rendition; additional responsive renditions or
transform-on-delivery may be added without changing Product ownership.

Binary storage and database commits cannot be one atomic transaction. Failed
metadata writes therefore trigger best-effort object cleanup, and operational
reconciliation remains a future hardening option.

## Rejected alternatives

- PostgreSQL byte storage couples transactional load and backups to large
  immutable assets.
- Persisting arbitrary remote URLs gives Catalog no integrity or cleanup
  control.
- Browser-held storage credentials violate least privilege.
- A separate Media business module adds ownership ambiguity before media is
  shared by more than Products.
- A full CMS or customer content model is outside the commerce platform.

