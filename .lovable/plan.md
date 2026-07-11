## What's already true

The 5 admin test accounts are **already pre-claimed and approved** in the database:


| Login                                                   | Org        | Role    |
| ------------------------------------------------------- | ---------- | ------- |
| [admin1@snagmaster.test](mailto:admin1@snagmaster.test) | Test Org 1 | admin ✅ |
| [admin2@snagmaster.test](mailto:admin2@snagmaster.test) | Test Org 2 | admin ✅ |
| [admin3@snagmaster.test](mailto:admin3@snagmaster.test) | Test Org 3 | admin ✅ |
| [admin4@snagmaster.test](mailto:admin4@snagmaster.test) | Test Org 4 | admin ✅ |
| [admin5@snagmaster.test](mailto:admin5@snagmaster.test) | Test Org 5 | admin ✅ |


Each user has a row in `org_members` with `role='admin'` linked to their org, so `getMyOrg()` returns the org immediately on first login and Snag Master, projects, DABS, etc. all unlock. No claim screen appears for these accounts.

## Why you still saw "Join an Organisation"

Two possibilities — I'll rule both out:

1. **You were signed in as a different account** (not one of the 5 seeded admins). Any other account has no org row and will see the join screen.
2. **Stale session/cache** from before the seed migration ran. A sign-out + sign-in fixes it.

## Plan

1. Verify by logging in to the preview as `admin1@snagmaster.test` / `SnagMaster2026!` via Playwright and confirming Snag Master loads directly into Test Org 1 (no claim prompt).
2. If it still shows the claim screen, patch `getMyOrg` / seed as needed. (Not expected — the data is correct.)
3. Regenerate the 5 onboarding PDFs so the "Claiming your organisation" section is replaced with a **"Your organisation is pre-approved"** page showing the org name/slug and a green "Pre-claimed ✓" badge, with Randall confirming no setup step is needed.
4. Save the refreshed PDFs to `/mnt/documents/Instructsite_Onboarding_Admin{1..5}.pdf`.

No schema changes, no app code changes — data is already in the right state; this is a verification pass + PDF copy update.

I only want the setails of each test account on there doc=ument. and a lot of the orange text is overlaid unreadlabel; can you change all these to make them more proffessional, im not to keen on the cartoon charachters either can you make them more realisytic.

&nbsp;