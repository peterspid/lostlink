<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# LostLink — agent guide

LostLink is a mobile-first lost & found web app (installable PWA). People post what they lost or
found, AI matches lost and found posts, the owner proves ownership by answering the finder's
private verification questions, and the two people chat privately (Nexconn) to arrange the
handover, without ever sharing phone numbers.

## User journeys (designed for a stressed person on a phone)

1. **First-time visitor** lands on the home page from a shared link or QR poster: sees nearby
   found items on a map/list without signing in, can open an item page (limited public details,
   fuzzed location). Any action (post, claim, alert) asks for a 20-second sign-up (name, email,
   password) and returns them to what they were doing.
2. **Report lost** (< 1 minute): pick "I lost something" → add photos (resized on the phone,
   uploaded to Blob) → Gemini reads the photo and pre-fills category, title, color, brand,
   material, marks → user edits → drop a pin or "use my location" → when (date/time or range) →
   post. Immediately sees ranked matches with readable reasons.
3. **Report found**: same flow, plus the finder moves identifying details (what's inside, serial,
   engraving) into **private verification questions**. Public view shows limited details and a
   location fuzzed to ~300 m.
4. **Match notification**: when a new post matches someone's post or saved alert, both sides get
   a Nexconn system-channel message plus an entry in the in-app notification center (bell with
   unread count). Tapping it opens the match.
5. **Claim**: owner taps "This is mine" on a found item, answers the verification questions,
   optionally picks which of their lost posts it is. A claim card (custom Nexconn message) lands in
   a private direct channel between owner and finder. The finder sees the answers next to the
   expected answers and approves or rejects. Rejected claimants get a polite result card;
   repeated wrong claims are rate-limited.
6. **Chat & handover**: after approval the two chat in real time (text, photos, read receipts,
   typing indicator). Either proposes a meeting point (location message) and time (handover
   card). The other accepts. After meeting, both tap "Returned"; the item closes, the owner can
   leave a thank-you note, the finder earns karma.
7. **Alerts**: "tell me if a black wallet is found within 3 km of here" saved searches, checked
   whenever a new found post arrives, delivered as Nexconn system messages + notification center.
8. **Desks** (campus, mall, station, event): an organizer creates a desk with a public page and a
   printable QR poster (PNG/PDF), invites staff by link, coordinates in a staff group channel, logs
   items into desk inventory, and handles claims like any finder.
9. **Browse**: map + list, search, filters (lost/found, category, distance, date), shareable item
   pages with Open Graph previews. Posts expire after 60 days; the owner gets a renew prompt.
10. **Safety**: block or report a user from any chat, claim or item page. Blocked users cannot
    message you (Nexconn blocklist) or claim your items; reported items are hidden after several
    independent reports.

Edge cases handled: AI busy (503/429) → form stays usable with manual entry; no location
permission → manual pin; offline/reconnecting chat banner; duplicate claims; claim on own item;
item already returned; expired posts.

## Live

- Production: https://lostlink-bay.vercel.app (Vercel project `lostlink`, region `sin1`)
- Repo: https://github.com/peterspid/lostlink

## Architecture

```
 Phone browser (PWA, Next.js App Router client)
   │  pages / forms ──────────────► Next.js route handlers (/api/*, Vercel functions, sin1)
   │                                  │  auth (bcrypt + JWT cookie), zod, rate limits (Postgres)
   │                                  ├─► Neon Postgres + pgvector (Drizzle)  items, matches, claims…
   │                                  ├─► Vercel Blob                          item photos
   │                                  ├─► Gemini (gemini-3.5-flash-lite → 3.1 fallback)  photo pre-fill
   │                                  │   gemini-embedding-2 @ 768d                   matching / search
   │                                  └─► Nexconn Platform Chat API (signed, server only)
   │                                        tokens · claim/result/handover cards (direct, metadata)
   │                                        system-channel notices · desk group channels · blocklist
   │
   └─ Nexconn Web Chat SDK (wss) ◄──────────► Nexconn (Singapore DC)
        direct chats · group staff rooms · system notices · receipts · typing · unread
```

Server logic is triggered by our own API (never console webhooks: the App Key is shared). After a
user acts (claim, approve, propose handover, returned) the server updates Postgres, then uses the
Platform Chat API to send/update the card in the users' direct channel.

## Folder map

```
src/app/                    pages (App Router) and API route handlers
  page.tsx                  home: split-flap board, wayfinding sign, route line, chat demo, desk band
  browse/                   map + list search with filters
  report/                   report wizard (photos → details → where/when)
  items/[id]/               item page (+ opengraph-image.tsx, claim/ form)
  chats/, chats/[claimId]/  conversation list and claim chat room
  alerts/ notifications/ profile/
  desks/ (new, [slug], [slug]/manage, join/[token])
  api/                      REST endpoints (auth, items, claims, alerts, desks, uploads, ai, cron…)
  manifest.ts offline/ icon.svg favicon.ico apple-icon.png   PWA + icons (scripts/generate-icons.mjs)
  robots.ts sitemap.ts opengraph-image.tsx privacy/ error.tsx global-error.tsx loading.tsx
src/components/
  chat/                     chat-provider (SDK engine), use-conversation (history, live, sends),
                            chat-room (claim flow), group-chat, message-view (ticket cards), composer
  landing/                  board (split-flap), wayfinding-sign, route-line, chat-demo, privacy-ticket, desk-band
  motion.tsx                Reveal (IntersectionObserver) and ScrollProgress (--p) primitives
  app-shell, site-footer, auth-shell, item-gallery, logo (LogoMark + wordmark)
  map/                      Leaflet + OSM (client-only)
  report-form, browse-view, location-field, item-tag, item-actions (safety menu), ui, sheet…
src/lib/
  db/ (schema.ts, index.ts) Drizzle schema + Neon client with connect-retry
  nexconn/server.ts         Platform Chat API client (signature, retries, backup host, groupExists)
  nexconn/users.ts          lazy (re-)registration: tokens remember their App Key, blocklist re-sync
  nexconn/messages.ts       custom message type names + payload types (shared)
  gemini.ts                 vision pre-fill + embeddings (retry, fallback, timeouts)
  match-score.ts            pure scoring + readable reasons (unit tested)
  matching.ts               candidate search (pgvector), match upserts, alert checks
  claims.ts claim-view.ts   claim state machine (claim → decision → handover → returned)
  items.ts search.ts desks.ts notify.ts poster.tsx ratelimit.ts validation.ts geo.ts time.ts
drizzle/                    SQL migrations (committed)
e2e/                        Playwright two-user tests (+ fixtures/wallet.jpg, CC BY-SA)
tests/                      Vitest unit tests
scripts/cleanup-test-users.mjs
docs/screenshots/           screenshots captured by the e2e run
```

## Data model (Postgres, `src/lib/db/schema.ts`)

- `users` id, nexconn_id (`llk`+random), nexconn_token, nexconn_app_key (key that issued the token), email, password_hash, name, karma, returned_count
- `items` id, code (5-char ref), owner_id, desk_id?, kind lost|found, status open|claimed|returned|closed|expired|hidden,
  category, title, description, attributes {color, brand, material, marks[]}, photos[], lat/lng (exact),
  public_lat/lng (fuzzed ~300 m), place_label, occurred_from/to, expires_at (+60 d), embedding vector(768) HNSW
- `verification_questions` item_id, question, answer (private, finder only)
- `matches` lost_item_id, found_item_id (unique pair), score, similarity, reasons[], distance_m
- `claims` item_id, lost_item_id?, claimant_id, finder_id, status pending|approved|rejected|returned|cancelled,
  answers[], note, card_message_id (Nexconn), handover {lat,lng,label,at,status,messageId}, owner/finder_returned_at, thank_you
- `alerts` (+ `alert_hits`) query, category?, lat/lng, radius_m, embedding
- `notifications` user_id, kind, title, body, href, read_at
- `desks` slug, name, kind, hours, place, lat/lng, owner_id, nexconn_group_id, invite_token; `desk_members`
- `blocks`, `reports`, `rate_limits`

## Nexconn features used (and where)

| Feature | Where |
| --- | --- |
| Access token issue (registers user) | `lib/nexconn/server.ts` `issueAccessToken`; `lib/nexconn/users.ts` (`chatToken`, `ensureRegistered`); `api/auth/signup`, `api/nexconn/token` (GET reissues tokens from another App Key, POST refresh after 31004) |
| Web SDK init (SG area), handlers before connect, connect, retry/backoff, 31004 refresh, 31010 kick | `components/chat/chat-provider.tsx` |
| Custom message types `LLK:ClaimCard`, `LLK:ClaimResult`, `LLK:Handover`, `LLK:Notice`, `LLK:DeskNotice` | `lib/nexconn/messages.ts` (registered in provider, rendered in `chat/message-view.tsx`) |
| Server-sent direct messages (`isEchoToSender`, `verifyBlocklist`, `hasMetadata`) | `server.ts sendDirectMessage`; used in `lib/claims.ts` for claim/result/handover cards |
| Message metadata (claim state, handover state) | `server.ts setDirectMessageMetadata` from `claims.ts`; client `onMessageMetadataUpdated` → `use-conversation.ts` |
| System channel messages (match, alert, claim, handover, expiry notices) | `lib/notify.ts` → `sendSystemMessage`; client detects `ChannelType.SYSTEM` → toast + notification centre |
| Direct channels (claim chats) | `chat/use-conversation.ts` (`DirectChannel`), `chat/chat-room.tsx` |
| Group channels (desk staff) | server create/join/leave/dismiss + bot group messages (`lib/desks.ts`, `server.ts`); `ensureDeskGroup` recreates a group missing under the current App Key (`/v4/group-channel/profile/list`); client `GroupChannel` in `chat/group-chat.tsx` |
| Text, image (`Helper.createSendImageMessageParams` + `sendMediaMessage` with progress), location (`SendLocationMessageParams` + OSM thumbnail) | `use-conversation.ts`, `lib/map-thumb.ts`, `chat/composer.tsx` |
| Read receipts (`needReceipt`, `sendReadReceiptResponse`, `getMessageReadReceiptInfo`, `onMessageReceiptResponse`) | `use-conversation.ts` |
| Typing indicators (`sendTypingStatus`, `onTypingStatusChanged`) | `use-conversation.ts`, chat header |
| Unread counts (`getTotalUnreadCount`, channel `unreadCount`, `clearUnreadCount`) | provider (nav badge), `chat/chat-list.tsx` |
| Channel list with latest message previews (`createChannelsQuery`) | `chat/chat-list.tsx` |
| History pagination (`createMessagesQuery().loadNextPage`), refetch after `onOfflineMessageSyncCompleted` | `use-conversation.ts` |
| User blocklist (`/v4/user/blocklist/add`, `/remove`) | `api/blocks/route.ts`; re-synced from Postgres on re-registration (`users.ts`) |

All Nexconn user ids and group ids are `NEXCONN_ID_PREFIX` (`llk`) + random alphanumerics. The bot
sender is `llklostlinkbot`.

## Env vars (names only)

`DATABASE_URL`, `DATABASE_URL_UNPOOLED` (migrations), `BLOB_READ_WRITE_TOKEN`, `NEXCONN_APP_KEY`,
`NEXCONN_APP_SECRET`, `NEXCONN_API_BASE`, `NEXCONN_ID_PREFIX`, `SESSION_SECRET`, `CRON_SECRET`,
`GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, `GEMINI_EMBED_MODEL`. Optional
`NEXT_PUBLIC_APP_URL`. Only the App Key reaches the browser (via `/api/nexconn/token`).

## Commands

```
npm install
vercel env pull .env.local --yes      # env from the linked Vercel project
npm run db:migrate                    # apply drizzle/ migrations (uses DATABASE_URL_UNPOOLED)
npm run db:generate                   # after editing schema.ts
npm run dev                           # http://localhost:3104
npm run typecheck && npm run lint
npm test                              # vitest unit tests
npm run test:e2e                      # Playwright against localhost:3104 (dev server running)
E2E_BASE_URL=https://lostlink-bay.vercel.app npm run test:e2e   # against production
SCREENSHOTS=1 npm run test:e2e        # also refresh docs/screenshots
node scripts/cleanup-test-users.mjs   # remove leftover e2e accounts
vercel deploy --prod                  # remote build + deploy
```

## Conventions

- TypeScript strict; zod validation on every API input; every route checks the session and
  ownership/participation (`requireUser`, `claimForParticipant`, `canManageItem`, `deskRole`).
- Server-only modules import `server-only`; the App Secret and Gemini key never leave the server.
- Route handlers wrap with `handle()` for uniform JSON errors (401/403/404/409/429/503 AI busy).
- Gemini: always read model names from env, retry 429/503 with backoff, fall back to the second
  model, cap output tokens, and keep the form usable when AI is unavailable.
- Pure logic (scoring, geo, text matching) lives in side-effect-free modules with unit tests.
- Design: station wayfinding + claim tickets. Colours: paper `#F2F3EE`, ink (transit navy)
  `#10243A`, signal (wayfinding yellow) `#FFC21A`, go (exit green) `#12805C` for approved/returned,
  alert `#C8321E`; everything else is a tint (tokens in `globals.css`). Overpass + Atkinson
  Hyperlegible Next, lucide icons, no decorative gradients. Lost = navy luggage tag, Found = yellow
  luggage tag (`KindMark`). Page titles use `PageHeader` with a pictogram plate; items are claim
  tickets (`ItemTag`). Motion only where it means something (board flip on load, scroll-filled
  route line, chat demo, feedback on actions); everything respects `prefers-reduced-motion`.
- Post-login redirects go through `lib/safe-next.ts`.
- Commits end with the Co-Authored-By line; work lands through squash-merged PRs.

## Testing

- `e2e/lostlink.spec.ts`: two browser contexts (owner and finder, mobile viewport, geolocation),
  real Nexconn, Gemini, Neon and Blob. Covers: lost post → found post with photo and Gemini
  pre-fill → match on the finder's page and live system-channel notice for the owner → claim with
  verification answer → finder approves (metadata flips card state live) → chat with read
  receipts and typing → location message + handover card accepted → both confirm returned →
  thank-you and karma. Second test: desk creation, QR poster PNG/PDF, invite link, staff group chat.
  Test accounts delete themselves (`DELETE /api/auth/account`).
- `tests/*.test.ts`: Vitest unit tests for scoring, explanations, geo fuzzing, time, answer and
  alert text matching, and the post-login redirect guard.

## Known limitations

- No push notifications to closed browsers (no web push / FCM configured). Offline users see
  notices in the notification centre and in Nexconn system-channel history when they return.
- Typing indicators are direct-channel only (as in the SDK). Place search and reverse geocoding use
  OpenStreetMap Nominatim, best effort; a pin always works.
- Claims on desk items go to the staff member who logged the item; other staff see them in the
  inventory and are told in the staff group chat.
- Reported items are auto-hidden after 3 independent reports; there is no admin review UI yet.
- The Nexconn App Key may be shared with other apps; ids are prefixed `llk`. Swapping keys is an
  env change only: users, blocklists and desk groups are re-created lazily under the new key, but
  chat history from the old key does not carry over (claim state lives in Postgres, so flows
  continue).
- Chat photos use Nexconn's file storage; item photos use Vercel Blob.
