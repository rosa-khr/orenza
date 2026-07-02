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

- Product, blend, roast, grind and weight models
- Price, inventory, SKU and publish state
- Product list/create/edit pages
- Product media and SEO fields

## Phase 3 — Orders and promotions

- Convert the current cart to persisted server orders
- Order statuses and timeline
- Tipax/Post shipping methods and configurable fees
- Card-to-card payment status and receipt upload
- Discount codes, limits and validity dates

## Phase 4 — Administration

- Admin shell aligned with the Khoobrooz panel interaction model
- Role-based access control
- Orders, customers, products, shipping and discounts
- Sent/unsent order monitoring
- Audit log for sensitive changes

## Phase 5 — Analytics

- GTM data-layer events
- GA4 ecommerce funnel
- Visitor, account, cart and order conversion metrics
- Dashboard summaries sourced from first-party order data and analytics
