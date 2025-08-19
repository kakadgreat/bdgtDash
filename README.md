# Budget Dashboard — v8
New in this version:
- Dashboard: Top 5 + Top 20 spend categories charts
- Data panel in left sidebar is a pill with Show/Hide
- Bills page: pills only from **Expense** categories (from Categories page), multi-select with light blue active state
- Stronger Edit/Delete buttons
- Date range filters on **Income** and **Bills**
- Export with current filters: CSV or Print-to-PDF (repeat header, no overflow)
- Pagination: 25/50/100/All
- New pages:
  - **Properties**: addresses, mortgage $, rate, start, escrow, notes
  - **Rentals**: address, tenant, rent, due day, deposit, lease start/end, status, maintenance, expenses, notes
- Persistence & auto-load from saved Google Sheet CSV URLs

Deploy: Netlify (build `npm run build`, publish `dist`)
