# Card Man Jam V2

A real Next.js storefront for curated card drops.

## Included

- Retro Card Man Jam Vault storefront
- Supabase product database
- Supabase email/password admin login
- `/admin/products/new` product uploader
- Multiple image uploads to Supabase Storage
- Stripe hosted Checkout
- $5 card/slab shipping
- $15 shipping whenever sealed is in the cart
- Stripe webhook order creation
- Automatic sold status after successful payment
- Admin inventory and orders pages
- Demo storefront fallback until Supabase is configured

## 1. Replace the GitHub repo

Back up the old repository, then upload the CONTENTS of this folder to the root of `cardmanjam/cardmanjam-website`.

Vercel should detect Next.js automatically.

## 2. Create Supabase

Create a Supabase project.

Open SQL Editor and run:

`supabase/schema.sql`

In Authentication, create one email/password user for yourself.

## 3. Add Vercel environment variables

Already added:
- `STRIPE_SECRET_KEY`

Add:
- `NEXT_PUBLIC_SITE_URL` = `https://www.cardmanjam.com`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (server-only and Sensitive)
- `ADMIN_EMAIL` = the exact email used for your Supabase admin user
- `STRIPE_WEBHOOK_SECRET` (added after the webhook is created)

Your existing `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` may remain, but hosted Stripe Checkout does not require it.

Redeploy after environment-variable changes.

## 4. Stripe webhook

In Stripe Sandbox:

Developers / Webhooks / Add endpoint

Endpoint:
`https://www.cardmanjam.com/api/stripe/webhook`

Subscribe to:
- `checkout.session.completed`

Copy the webhook signing secret beginning with `whsec_` into Vercel as:

`STRIPE_WEBHOOK_SECRET`

Redeploy.

## 5. Test

1. Log in at `/admin/login`
2. Add a real test product.
3. Add it to cart.
4. Complete Stripe Sandbox checkout.
5. Confirm:
   - an order appears in `/admin/orders`
   - the product becomes sold
   - the product disappears from the storefront

## Important before live launch

- Complete Stripe identity and payout setup.
- Replace sandbox keys with live keys.
- Create a separate live webhook and live webhook secret.
- Register for and correctly configure sales tax where required.
- Review Terms, Privacy, Shipping, Return and Condition policies.
- Add inventory reservation to prevent two buyers from checking out simultaneously.
- Add transactional order and shipment emails.
- Add shipping-label integration.
- Do not expose `SUPABASE_SECRET_KEY`, `STRIPE_SECRET_KEY`, or `STRIPE_WEBHOOK_SECRET`.

## Current limitation

Inventory is checked when Stripe checkout starts and marked sold after the successful webhook. It is not temporarily reserved while the buyer is on Stripe. Keep the store private/test-only until reservation logic is added.
