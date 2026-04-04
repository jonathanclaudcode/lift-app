# SMS Integration Test Plan (46elks)

## Utgående SMS

1. **Happy path** — Skicka meddelande med `channel='sms'` → SMS skickas via 46elks → meddelande-status uppdateras till `'sent'` → `external_message_id` sparas.
2. **46elks API-fel** — API returnerar HTTP 4xx/5xx → meddelande-status sätts till `'failed'`, ingen crash i UI.
3. **Klinik utan telefonnummer** — `clinics.phone` är NULL → meddelande-status `'failed'`, loggmeddelande: `[SMS] Clinic {id} has no phone number configured`.
4. **Timeout** — 46elks svarar inte inom 10s → AbortController avbryter → status `'failed'`.

## Inkommande SMS

5. **Befintlig kund** — SMS från känt nummer → meddelande skapas i rätt konversation → `unread_count` +1 (via trigger `update_conversation_on_message`).
6. **Ny kund** — SMS från okänt nummer → ny kund skapas → ny konversation (`channel='sms'`, `status='active'`) → meddelande sparas.
7. **Internationellt nummer** — SMS från t.ex. `+4790123456` (norskt) → kund skapas med E.164-nummer.
8. **Idempotency** — Samma 46elks `id` skickas två gånger → bara ett meddelande sparas (SELECT-check + framtida UNIQUE constraint).
9. **Webhook utan auth** — Request utan giltig `Authorization`-header eller `?token=` → HTTP 401.
10. **Ogiltigt from-nummer** — Alfanumeriskt eller icke-normaliserbart nummer → error loggas, returnerar 200 (kraschar INTE).
11. **Saknade fält** — Webhook utan `message`-fält → error loggas, returnerar 200.

## Telefonnummer-normalisering

| # | Input | Förväntat output |
|---|-------|------------------|
| 12 | `0701234567` | `+46701234567` |
| 13 | `+46701234567` | `+46701234567` (oförändrat) |
| 14 | `46701234567` | `+46701234567` |
| 15 | `004670123456` | `+4670123456` |
| 16 | `070-123 45 67` | `+46701234567` |
| 17 | `+4790123456` | `+4790123456` (norskt, oförändrat) |

## Regression

18. **Web-kanal oförändrad** — Skicka meddelande med `channel='web'` → fungerar exakt som innan (status sätts direkt till `'sent'`, inget SMS-anrop).

## Webhook-konfiguration

19. Konfigurera webhook-URL i 46elks dashboard med EN av:
    - `https://ELKS_API_USERNAME:WEBHOOK_SECRET@dindomän.se/api/webhooks/sms` (Basic Auth)
    - `https://dindomän.se/api/webhooks/sms?token=WEBHOOK_SECRET` (Query param fallback — rekommenderas om Vercel strippar Auth-header)
20. Inkommande SMS-testning kräver ett riktigt 46elks-nummer. Test-numret `+46766861004` fungerar bara som `from` vid utgående SMS.

## Kända begränsningar

- **`'sent'` ≠ levererat.** Status `'sent'` betyder att 46elks API accepterade begäran. Delivery reports (DLR) implementeras separat.
- **Multipart SMS.** SMS längre än 160 tecken (GSM-7) eller 70 tecken (Unicode/emojis) delas i multipart av 46elks och kostar mer per segment. Ingen längdvalidering eller varning i UI.
- **Supabase-avbrott vid webhook.** Om Supabase är nere vid webhook-mottagning förloras SMS:et (returnerar 200 utan insert). 46elks retry:ar inte vid 200-svar.
- **Stuck 'sending'-status.** Om UPDATE misslyckas efter lyckad `sendSms`, stannar meddelandet som `'sending'` utan cleanup.
- **Ingen rate limiting.** Webhook-endpointen har ingen rate limiting. I dev utan `ELKS_WEBHOOK_SECRET` accepteras alla requests.
- **Realtime-uppdatering.** Inkommande SMS i UI kräver att Supabase Realtime eller polling triggar cache-invalidering i TanStack Query. Verifieras separat.
- **Idempotency.** `external_message_id` har ingen UNIQUE constraint — idempotency-checken är best-effort via SELECT. TODO: lägg till UNIQUE constraint i framtida migration.
- **Trigger `update_conversation_on_message`.** Filtrerar korrekt på `direction = 'inbound'` — enbart inkommande meddelanden ökar `unread_count`. Utgående SMS påverkar inte unread.
