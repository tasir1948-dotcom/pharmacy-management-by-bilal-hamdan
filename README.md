# PharmaDesk — Pharmacy Management (GitHub Pages)

A responsive, browser-based pharmacy inventory and billing starter built with plain HTML, CSS and JavaScript.

## Included
- Dashboard with today's sales, medicine count, low-stock and expiry alerts
- Medicine inventory: add, edit, delete, search and filter
- Sales billing cart with stock checks and automatic stock deduction
- Purchase entry that increases stock
- Sales history and CSV exports
- Responsive layout for desktop and mobile
- Browser localStorage persistence

## Run locally
Open `index.html` in a modern browser. No build tools are required.

## Publish on GitHub Pages
1. Create a new GitHub repository, for example `pharmacy-management`.
2. Upload `index.html`, `styles.css`, `app.js`, and `README.md` to the repository root.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select branch **main** and folder **/(root)**, then save.
6. Wait for GitHub Pages to publish the site. Your site URL will appear on the Pages settings screen.

## Important limitations before real-world use
This is a front-end starter/demo, not a secure production pharmacy system.
- Records are stored only in the current browser on the current device. They do not sync between computers or staff accounts.
- Clearing browser data can erase the records. Export and safely back up records regularly.
- There is no real authentication, server database, audit log, role management, payment integration, or encrypted backup.
- Do not enter patient-identifying or other sensitive information into this demo.
- Verify medicine, batch, expiry, prices, tax rules and all transactions independently. Follow applicable pharmacy and data-protection regulations.
- GitHub Pages hosts static files; for multi-user access and secure shared records, connect a properly secured backend and database before using it operationally.

## Suggested next production upgrades
A secure backend/API, database backups, staff roles, audit trail, barcode scanning, supplier/customer ledgers, invoice printing, tax configuration, and tested restore/export workflows.
