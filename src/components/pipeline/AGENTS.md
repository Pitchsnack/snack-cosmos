# Pipeline decisions

- Email alerts: defaults live in email-alerts.ts with Admin overrides; sends use sendAlert's user switch and log. NDA RPCs store events transactionally before pipelineAlert; other Pipeline actions use log(), preventing duplicate NDA history.
- Seller/buyer Pipeline shares workspace-page/cards and five content routes plus the legacy status redirect; authenticated DTOs own invitations/counts, stable pipeline IDs own watchlist stars. workspace-reports embeds ReportsHub behind a deal selector, never a table; pipelinePage gates per-buyer extras, preserving /my-reports and pop-ups.
- NDA Invitations uses browser-safe bucketing/sorting and a shared list separate from preserved profile dialogs; service-only atomic NDA RPCs serialize invitation withdrawal, request linking and seller decisions after server role/scope checks. Unfiltered requests remain available for the unchanged parent badge/review alert, while signedPipelineOpen gates deal lists/counts.
