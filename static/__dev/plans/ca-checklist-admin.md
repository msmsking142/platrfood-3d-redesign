---
created: 2026-10-14T07:05:14.959Z
updated: 2026-10-14T07:05:14.959Z
---

# CA Questions tab in Admin

## Pages
- **Admin (/admin)** – a new **"CA questions"** section, with a link in the admin top nav next to Finance/Pricing.
  - Shows all 12 CA questions (GST on delivery, food, Pro subscription, commission, platform fee, TDS, riders, ITC, customer invoice, restaurant invoice, founder income tax, registrations), using the same text as the current checklist.
  - Each question has a text box for the CA's answer and its own **Save** button, plus a "last saved" time.
  - A **Copy all questions** button copies the full list (with any saved answers) so it can be pasted into WhatsApp/email for the CA.
  - Shows a progress count, for example "5 of 12 answered".
  - Note at the bottom: "When all answers are filled, ask Floot AI to update the app to match."

## User accounts
- Only the admin (founder) can see and edit this section.

## Look & feel
- Matches the existing admin cards (white card, rounded corners, Zipto yellow highlights).

## What it remembers
- **CA answers**: question number, answer text, last updated time. The question text stays in code. Only the answers are saved.

## How it works
- The admin overview loads the saved answers along with the rest of the admin data.
- Saving an answer goes through the existing admin action endpoint (a new "save CA answer" action), and the list refreshes after each save.
- The answers don't change any tax settings by themselves. Once they're in, Floot AI uses them to update the GST/TDS settings and invoices.

## Outside services
- None.
