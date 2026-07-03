# Orenza commerce roadmap

## Phase 1 — Customer account

Status: implemented.

- Phone and password registration/login
- Google Identity login endpoint and UI integration
- Opaque, hashed server sessions in HttpOnly cookies
- Customer profile
- Multiple delivery addresses with one default address
- Password creation/change
- PostgreSQL persistence
- Mobile-first account UI

### Enable Google login

1. Open Google Cloud Console and create or select a project.
2. Configure the OAuth consent screen.
3. Create an OAuth 2.0 Client ID with application type `Web application`.
4. Add `https://orenza.ir` to Authorized JavaScript origins.
5. Put the client ID in `.env`:

```dotenv
GOOGLE_CLIENT_ID=000000000000-example.apps.googleusercontent.com
```

6. Rebuild both frontend and API:

```bash
docker compose up -d --build
```

The project uses Google Identity Services ID tokens. No Google client secret is
shipped to the browser.

## Phase 2 — Product catalog

Status: implemented.

- Product, category, roast, grind and weight models
- Per-weight pricing and active state
- Product list/create/edit/view/delete pages
- Product image URL and bilingual title

## Phase 3 — Orders and promotions

Status: implemented.

- Persisted server orders with server-side price calculation
- Order and payment statuses
- Tipax/Post selection
- Active card-to-card payment details and receipt URL
- Discount codes, limits and validity dates

## Phase 4 — Administration

Status: implemented.

- Astro admin shell aligned with the Khoobrooz interaction model
- Session and role-based access control
- Orders, products, categories, payment methods, discounts, articles and tags
- Sent/unsent order monitoring
- Responsive list/add/edit/view routes

## Phase 5 — Analytics

Status: partially implemented.

- GTM remains active.
- First-party 30-day unique visitor count is shown in admin.
- Dashboard summaries are sourced from orders, customers, products and visits.
- GA4 ecommerce funnel events remain a future enhancement.
