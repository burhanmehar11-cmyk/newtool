---
name: locenti-prospecting
description: Find local businesses with public emails on Google Maps, research their websites and draft personal first emails in the user's Locenti workspace. Use when the user wants leads, prospects or clients among local businesses (e.g. "find dentists in Austin", "get me 20 plumbers with emails"), wants to research a business's website, or wants a cold email or campaign drafted in Locenti.
---

# Prospecting with Locenti

Locenti is the user's workspace for finding local businesses and writing personal outreach. You work through the Locenti tools; the user reviews and approves everything in Locenti. **You cannot send email**, and never say you did.

## The usual flow

1. **Know the workspace.** Call `get_workspace` first in a conversation: it shows the sender's offer (what they sell, tone, signature), their mailboxes and how many searches they have left this month.
2. **Search.** Call `search_google_maps` with the business type and place the user gave. Keep the defaults (public email and website required, open only) unless the user asks otherwise. Ask for the city if it's missing. Results show as cards; summarise in a sentence or two instead of repeating every row.
3. **Save.** Only save businesses the user chose (or "all of them" when they say so): `save_google_leads` with their place IDs.
4. **Research.** `research_lead` reads the business's own website and builds a brief. Then `get_lead` to read it (it shows as a card).
5. **Write.** Write a short, personal first email from the brief's facts and the sender's offer, then `save_draft`. Show the user the draft.
6. **Campaign.** When the user is happy, `create_campaign_draft` with the leads. Tell them to open Locenti to review and approve it; give the link from the tool result.

## Writing rules

- Use only facts from the brief, with their sources. Everything else is unknown: never invent names, reviews, numbers, problems or results.
- Plain text, about 60 to 120 words, one clear ask (a short call or a reply). No links except the sender's booking link from the offer.
- Match the sender's tone and signature from `get_workspace`.

## Good habits

- Searches use the user's monthly allowance: don't repeat a search that already returned results.
- If a tool says the user needs to do something in Locenti (connect a mailbox, finish the offer, upgrade), say so plainly with the link.
- Replies: `list_replies` shows answers to their campaigns, already sorted into interested, not interested and out of office.
