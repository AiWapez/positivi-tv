# Security policy

PositiviTV is a free, public website that shows headlines from a small set of publishers and links to the original articles. Visitors cannot submit content, and visitors never trigger collection.

## Reporting a problem

If you find a security problem, please report it privately through GitHub: open the **Security** tab of this repository and choose **Report a vulnerability**. Please do not open a public issue for security problems.

Helpful details: what you found, the steps to see it, and what an attacker could do with it. Please do not disrupt the site, and do not try to access anyone else's data. PositiviTV doesn't run a paid bug bounty.

## What is in scope

- The website and its `/api/stories`, `/api/collect` and `/api/refresh-feeds` endpoints.
- The collection code that fetches publisher feeds.
- This repository's code and GitHub workflows.

The publishers' own websites are not in scope; please report issues there to the publisher. Problems with GitHub or Vercel themselves should be reported to those companies.

## How the project protects itself today

- Collection runs only on a schedule and requires a secret; visitors cannot start it.
- The fetcher only contacts listed publisher hosts, checks robots.txt, refuses private network addresses on every redirect, and limits response size and time.
- Feed text is shown as plain text, never as HTML.
- Storage is private, and writes are conditional so two runs cannot overwrite each other.
- GitHub workflows use read-only tokens and actions pinned to exact versions.
