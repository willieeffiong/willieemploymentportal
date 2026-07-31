## Willie Lab Tech portal — major upgrade

Two things need your decision before I start (see "Decisions needed" at the end). Everything else I'll build straight through in the phases below.

### Phase 1 — Database & security foundation
- New columns on applicant profiles: security question + hashed answer, years of experience, experience description, notification preferences.
- New tables: `app_settings` (application deadline + open/closed flag, admin-controlled), `login_attempts` (lockout after 5 failed tries for a few minutes), `documents` gains a category (`qualification` / `skill`) and verification status, `chat_threads` + `chat_messages` for the Research Assistant history.
- Passwords are already hashed by the auth system (never plain text) — no change needed there, I'll confirm it in writing.
- Documents stay in a private bucket with signed, expiring links only — no public URLs. I'll re-verify the access rules.

### Phase 2 — Registration, login, security questions
- Registration requires three names (first, middle, surname) with the exact error message you specified.
- Duplicate email blocked with "An account with this email already exists. Please log in instead."
- Security question + answer required at registration; answers stored hashed.
- "Forgot Password?" on login → answer your security question → set a new password. No email OTP anywhere.
- Existing accounts (including admin) are prompted to set a security question at next login; same for any missing email.
- Login lockout after 5 failed attempts.

### Phase 3 — Application form rework
- Skills box: 30-word minimum, 300-word maximum, live "12/30 words" counter, blocking validation message.
- New Experience section: years-of-experience dropdown (your six options) + description box with the same 30/300 word rules and counter.
- State dropdown with all 36 states + FCT; LGA dropdown populates from the selected state using complete standard Nigerian LGA data.
- Uploads split into "Qualification certificates (Required)" and "Additional / skill certificates (Optional)", each accepting multiple files, each with "Upload as PDF" and "Upload as Image (JPEG/PNG)" buttons, with a removable list before submission.
- Profile picture section labelled "Upload your profile picture here."

### Phase 4 — Document verification
Each upload is read by AI before being accepted: it checks the document is legible and matches the selected qualification. Rejections show your exact messages and keep the applicant on the upload section to retry; passes show "Document accepted."

### Phase 5 — Lock/edit submitted application
- After submission everything renders read-only with a small Edit icon per field/section.
- Main button shows greyed-out "Submitted"; editing any field flips it to an active "Submit".
- Abandoned edits save nothing; submitted edits replace the old values and appear immediately in the admin portal, then the button returns to "Submitted".

### Phase 6 — Deadline & admin control panel
- After the deadline: registration closed message, apply section replaced with "Applications are now closed." Existing users keep full access; admin portal is never restricted.
- Admin menu gains "Manage Application Period": extend deadline, close early, reopen, with a live status line ("Applications: OPEN — closing 10 Aug 2026"). Changes take effect portal-wide instantly, no re-publish.

### Phase 7 — Settings (applicant + admin)
Change password (verified by security question), view/replace security question and answer, update contact/profile info, notification preferences.

### Phase 8 — Research Assistant
- New page on both portals: general-knowledge chat, saved chat history you can reopen and continue from where you left off, however long ago.
- Admin-only: real-time questions about portal data (applications, accepted/rejected/pending counts) pulled live from the database, never exposed to applicants.
- Applicant-side: answers about who owns the portal, its purpose, the 20 engineering fields recruited for, and the sponsor.

### Phase 9 — Polish
- Regenerate the 20 engineering-field images depicting Nigerian/African engineers.
- Logo fills its circle edge-to-edge, no white gap.
- Hide the Lovable badge site-wide.
- Fix back-button behaviour so navigating back never logs anyone out — only the Logout menu item ends a session.
- Email notifications on status change, new submission, new message, and admin replies — best effort (see below).

### Decisions needed

**1. The Gemini API key.** Do not reuse that key — it is now exposed in chat, so please revoke it. It is also not needed: this project already has built-in AI access (no key, no separate billing setup), which I'll use for both the Research Assistant and document verification unless you insist on your own Gemini key, in which case I'll request it through the secure secret form rather than chat.

**2. Email sending.** Emails require a domain you own to be verified as the sender — there is no free shared sender. Until that's set up, I'll wire the notifications so they work the moment a domain is verified, and in-portal notifications (bell + Notifications page) remain the primary alert. Tell me if you want to set up a sender domain now.

### Technical notes
- Word counters and validation run in the form and are re-checked on the server at submission.
- Security answers are hashed, never returned to the browser; reset attempts are rate-limited like logins.
- Application-period state lives in a single settings row read by the homepage, registration, and apply flows, so one admin change propagates everywhere.
- Chat history is per-user with row-level security so no applicant can read another's threads or the admin's.
