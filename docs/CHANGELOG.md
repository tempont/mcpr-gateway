# Changelog

All notable changes to MCPR Gateway are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)

---

2026-05-07 - Fixed - DEMO_MODE env var is now case-insensitive (accepts TRUE, True, true, etc.), matching the startup script behavior.
2026-05-07 - Changed - DEMO_MODE now allows admin panel access with default demo credentials (user: demo, password: demo) displayed on the login page.
2026-05-07 - Added - DEMO_MODE environment variable for safe public demos. Forces memory sessions, anonymous identity, and disables admin/debug/embedded-OAuth routes.

## [Released 1.0] — 2026-03-30

- Initial release
