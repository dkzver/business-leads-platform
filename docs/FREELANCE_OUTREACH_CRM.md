# Freelance Outreach CRM

## Purpose
A private CRM for an independent developer to research prospective business clients worldwide and prepare relevant, personalized service proposals in Russian or English.

## Current capabilities
- Company/contact database with search, country/city/industry/status filters.
- Lead statuses: New, Proposal prepared, Contacted, Replied, Not a fit.
- Editable bilingual proposal templates for websites, web applications, workflow automation, mobile apps, cleaning businesses and auto repair shops.
- Personalization placeholders: `{{company}}` and `{{your_name}}`.
- Copy a proposal or open a prefilled email draft in the user's local mail client. Sending remains a deliberate manual action.
- CSV export of the currently loaded/filtered leads.
- PostgreSQL persistence and HTTP Basic authentication via `APP_PASSWORD`.

## Global targeting and language
The CRM is configured for worldwide prospecting. Templates are available in Russian and English. The app does not yet perform automatic worldwide company discovery or website audits; leads must currently be added manually or collected externally and entered into the CRM. CSV import and compliant discovery integrations are planned follow-up work.

## Responsible outreach
Use public business contact details only where lawful, keep messages relevant and individually reviewed, identify the sender truthfully, respect local direct-marketing/privacy rules, and promptly suppress contacts that object or unsubscribe. Do not use this CRM for indiscriminate bulk spam. The app does not send bulk campaigns automatically.

## Deployment
- Runtime: Node.js / Express
- Database: PostgreSQL
- Render Blueprint: `render.yaml`
- Required environment variables: `DATABASE_URL`, `APP_PASSWORD`
- Health endpoint: `/api/health`
- Start command: `npm start`

## Next development milestones
1. CSV import with duplicate detection and validation.
2. Lead research workspace: website URL, evidence-backed observations, opportunity, fit score and source.
3. Activity timeline and follow-up reminders.
4. Optional authenticated email provider integration with explicit per-message approval, rate limits, suppression list and audit log.
5. Lawful company discovery adapters for supported public sources/APIs, with source attribution and geographic filters.

## CSV import
Use the **Импорт CSV** button. UTF-8 CSV files with comma or semicolon separators are supported. The first row must contain a company-name column (`name`, `company`, `название`, or `компания`). Recognized optional columns include country, city, category/industry, phone, email, website, source, status and notes. Each import is limited to 1,000 rows. Duplicate matching checks company + city + country, email, and normalized website. Rows without a company name are skipped.

## Website audit
Each company row has a manual website-audit action. The checklist covers HTTPS, mobile usability, service clarity, contact visibility, enquiry form, portfolio, online booking and perceived loading speed. The displayed percentage is a simple count of manually checked items, not a Lighthouse score or automated technical assessment. Save concrete observations and suggested improvements in the opportunity and notes fields.


## On-demand prospect discovery

The **Найти заказчиков** button runs a server-side Brave Search API workflow across 12 country/language markets (US, UK, Canada, Australia, Germany, France, Switzerland, Russia, India, Singapore, Brazil and the Netherlands). Configure the secret `BRAVE_SEARCH_API_KEY` in Render → service → Environment. Obtain a key at https://api-dashboard.search.brave.com/. The key is never sent to the browser or committed to Git.

The worker searches public web results, excludes major social networks/directories/job boards and known hosted-site platforms, then checks up to 18 candidate HTTPS pages per run. It applies timeouts, a 750 KB response limit, no redirects, and DNS checks rejecting private/local IP ranges. It does not crawl whole sites. It requires organization metadata and a concrete public signal such as a direct developer request, construction notice, missing viewport tag or no HTML form on a contact page. Absence of a form on one page is not proof the whole website lacks forms. Evidence, service fit, priority and RU/EN draft messages are stored in a separate discovery list; the user manually adds selected prospects to the company CRM. No personal contacts are harvested and no messages are sent. Search history is retained for 90 days. All signals and contact details require manual review.
