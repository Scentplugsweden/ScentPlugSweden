# ScentPlugSweden V7 — Launch build

V7 is the **launch candidate** built on V6.

## What was added

### Payments — Stripe Checkout
- Server-side price and stock validation.
- Hosted Stripe Checkout.
- Order is created as `Betalning väntar` before redirect.
- Stock is reserved while checkout is active.
- `checkout.session.completed` marks the order `Betald`.
- `checkout.session.expired` releases reserved stock and marks the order cancelled.
- Stripe webhook signature verification uses the raw request body.
- Stripe secrets stay server-side in `.env`.

### Shipping — PostNord
- Checkout has a clear **PostNord** delivery option.
- 49 kr shipping, free shipping from 399 kr.
- Shipping method and shipping price are saved with the order.
- Admin can enter the PostNord tracking number.
- Customer order page shows the tracking number once it is added.
- V7 does **not** pretend to have automatic PostNord booking before API access is approved.

PostNord's current Booking API can support transport bookings and shipping documents, but PostNord says you need an application ID to get started. See the official PostNord API pages before implementing the exact Booking API payload for your agreement.

### Admin
- Order dashboard.
- Payment-pending status.
- Search/filter.
- Order status management.
- Tracking number management.
- Product CRUD.
- Per-size stock.
- Low-stock indicators.

### Customer experience
- Order tracking by order number + email.
- Payment success page.
- PostNord shipping summary.
- Stripe payment notice.
- Basic Terms and Privacy pages included as placeholders.

## Local setup

1. Copy `.env.example` to `.env`.
2. Install dependencies:

```powershell
npm install
```

3. Set a strong admin password:

```powershell
$env:ADMIN_PASSWORD="YOUR_STRONG_ADMIN_PASSWORD"
```

4. Add your Stripe test secret:

```text
STRIPE_SECRET_KEY=sk_test_...
```

5. Start:

```powershell
npm start
```

Open:

- Shop: `http://localhost:3000`
- Admin: `http://localhost:3000/admin`
- Tracking: `http://localhost:3000/order`

## Stripe setup

### A. Create Stripe account
Create/verify the Stripe account for the business. Use **test mode** first.

### B. API key
In Stripe Dashboard, get the **Secret key** and put it in `.env`:

```text
STRIPE_SECRET_KEY=sk_test_...
```

Never put this key in `public/app.js`.

### C. Local webhook testing
Install the Stripe CLI, log in, then run:

```powershell
stripe listen --forward-to localhost:3000/webhook/stripe
```

The CLI prints a webhook signing secret beginning with `whsec_`. Put it in:

```text
STRIPE_WEBHOOK_SECRET=whsec_...
```

Restart the Node server after changing `.env`.

### D. Test a payment
Open the shop, add a product, select PostNord, complete checkout, and use Stripe's official test card details in the Stripe Checkout page.

### E. Production webhook
After deployment, create a Stripe webhook endpoint:

```text
https://YOUR-DOMAIN/webhook/stripe
```

Enable at least:

- `checkout.session.completed`
- `checkout.session.expired`

Copy the endpoint signing secret into production:

```text
STRIPE_WEBHOOK_SECRET=whsec_...
```

Also change:

```text
STRIPE_SECRET_KEY=sk_live_...
BASE_URL=https://YOUR-DOMAIN
```

Do not use live keys until test checkout + webhook + stock handling have been verified.

## PostNord launch workflow before API access

Until PostNord API access is available:

1. Customer pays through Stripe.
2. Admin sees `Betald`.
3. Pack the order.
4. Book/create the shipment using the PostNord business workflow you have access to.
5. Copy the returned tracking number into Admin.
6. Set order status to `Skickad`.
7. Customer sees the tracking number on `/order`.

When PostNord API access arrives, integrate the exact Booking API contract supplied for your PostNord account. Do not guess endpoints, service codes, customer numbers, or payload fields.

## Production checklist

Before launch:

- [ ] Replace placeholder Terms and Privacy text with the real company policies.
- [ ] Use HTTPS.
- [ ] Set a strong admin password in the host's secret/environment settings.
- [ ] Use Stripe live keys only in production secrets.
- [ ] Configure the Stripe production webhook.
- [ ] Test successful payment.
- [ ] Test failed/cancelled checkout.
- [ ] Test expired Checkout Session and stock release.
- [ ] Test a real admin order update.
- [ ] Test PostNord manual shipment + tracking.
- [ ] Test mobile checkout.
- [ ] Test out-of-stock behaviour.
- [ ] Verify business, tax, consumer-rights, returns and privacy requirements before selling to the public.

V7 is a launch candidate, not a legal or accounting approval.


## Persistent product and order storage on Railway

Products and orders are stored in `DATA_DIR`. On Railway, mount a persistent Volume at `/data` and leave `DATA_DIR` unset; the server automatically uses `/data`. On first startup, the bundled `products.json` and `orders.json` are copied there if they do not already exist. This prevents products and orders from disappearing on redeploy.

## Product images

The admin product form expects a direct URL to the original/high-resolution image. Avoid Google Images thumbnails or preview URLs. Product cards and the product modal use `object-fit: contain` so perfume bottles are not unnecessarily cropped.
