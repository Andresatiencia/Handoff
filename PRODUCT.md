# Handoff

<!-- impeccable:product-schema 1 -->

## Platform

Web marketplace for the University of Central Missouri.

## Users

Students leaving campus with usable essentials and students arriving who need them, especially international students setting up for a semester. University affiliation is self-reported; enrollment is not verified.

## Product Purpose

Connect students across the semester handoff so furniture, kitchenware, winter clothing, and other essentials keep being used. A student's arrival or departure date should make pickup timing understandable alongside an item's price, condition, and availability.

## Positioning

"Good things. New beginnings." Handoff is a student-to-student exchange organized around the move-out and move-in window. Students can browse individual listings, contact sellers privately, or reserve a whole move-in bundle. The product does not collect payment.

## Operating Context

The interface uses English and USD. University of Central Missouri is the only selectable university. The routes are `/`, `/marketplace`, `/arriving`, `/leaving`, `/account`, `/verify-email`, `/sell`, `/bundles/new`, `/bundles/:id`, and `/messages`. Arrival details pass through marketplace URL parameters; they are not saved as an account profile.

## Capabilities and Constraints

- Accounts support registration, sign-in, sign-out, server-side sessions, and ownership checks. Optional email ownership verification applies to new accounts when delivery is configured; a 24-hour, single-use link requires an explicit confirmation. While verification is required, unverified accounts can browse but cannot post, claim bundles, or send messages. Existing accounts remain usable. Local development can print verification links to the server console when email delivery is not configured; production without both required email settings keeps the previous signup behavior and does not claim to verify addresses.
- Sellers can post persistent individual listings, upload optional real product photos, change listing status, and delete their listings. Listings without photos use a neutral, typographic category fallback.
- The marketplace supports category, text, status, university, inclusive arrival-date, and optional minimum/maximum price filters. An arrival date can restrict individual results to their availability window.
- Buyers can start private per-listing conversations with sellers. Messages refresh by polling; pickup for individual listings is coordinated in messages. Individual listing status is managed by sellers; buyers cannot claim individual listings through a reservation action.
- A seller can post a real bundle of 2–12 named items with conditions, an availability window, a bundle price, and an estimated new cost. Arriving students can enter specific needs; bundle cards show needs coverage, timing, and estimated savings. A signed-in buyer can reserve a real bundle once, atomically in the database. Bundle pickup coordination is not integrated with item messaging.
- Five **labeled demo bundles** illustrate the bundle flow. A demo reservation is personal to the signed-in viewer and does not arrange a real pickup. Demo bundles and their illustrative seller names are distinct from seller-posted bundles and live individual listings. The live individual marketplace starts empty until students post listings.
- No payments, enrollment verification, password recovery, general notifications, or moderation are implemented. Email ownership confirmation proves access to a mailbox at that moment; it does not verify student enrollment. Estimated new costs are seller-entered estimates.

## Brand Commitments

The owner selected the **Hands** visual direction and approved its full frontend integration. Warm ivory, terracotta, and dark ink pair with DM Sans task text, Instrument Serif headings, and a Manrope wordmark. Photographic cutout chair, lamp, and kitchen essentials illustrate one student's departure becoming another student's arrival. A leaving/arriving toggle makes that change interactive. These objects are illustrative and must stay clearly separate from real listing photos and real inventory.

The identity is warm, energetic, memorable, and readable. Task screens for browsing, forms, account, bundles, and messages keep a calm hierarchy with visible timing and actions. The approved fallback for missing listing photos is typographic and plainly labeled.

## Evidence on Hand

The approved Hands implementation in the current frontend, `README.md`, and the existing API and database contracts. `design-review/LUNA-RESERVE-BRIEF.md` records an earlier audit and three prototype directions; its pending-choice language and Room recommendation are historical, not the current decision. Demonstration content remains labeled and separate from live data. Do not fabricate testimonials, real users, metrics, listings, or available universities.

## Product Principles

- Explain arriving, leaving, and browsing immediately.
- Make availability and pickup dates easy to compare with price and condition.
- Keep real listing, account, bundle, and messaging behavior intact when changing the interface.
- Give mobile navigation and forms dedicated layouts and clear task completion states.
- Keep illustrative content and demos visibly distinguished from real offers.

## Accessibility & Inclusion

Use visible keyboard focus, labels, readable contrast, reduced-motion behavior, comfortable touch controls, and layouts without mobile overflow. The arriving/leaving scene remains understandable through text and controls when motion is reduced.

## Open Decisions

The visual direction is settled. This redesign branch is to be delivered for review as a pull request; no merge or manual production deployment is part of the design approval.
