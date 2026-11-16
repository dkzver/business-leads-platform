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
