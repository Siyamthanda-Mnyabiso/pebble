# Payment gateway assessment for Pebble

Status: research only. Nothing is connected. `payments_enabled = 0` and `gateway_ready = 0` stay as they are
until a gateway is chosen, tested in its sandbox and approved by the owner.

## What Pebble needs

1. Collect a card or EFT payment from the customer in ZAR.
2. Keep the money from being paid out to the provider until the customer confirms the job (or 24 hours pass),
   and never release it while a dispute is open.
3. Pay the provider their price minus the commission, to a bank account, on Pebble's schedule.
4. Refund fully or partly, including after a dispute decision.
5. Send signed webhooks, so a booking is only marked paid from a verified server event.
6. Onboard independent providers (often a sole trader with a personal bank account) without heavy paperwork.
7. Record the processing fee per payment, kept apart from the provider's earnings.

Important: holding customer money for someone else and paying it out later may count as regulated activity in
South Africa (a payment-service or a trust arrangement). Pebble should not build its own "escrow" in its own bank
account. Get the legal and compliance position from the gateway and a lawyer before launch.

## What I could and could not confirm

All of this came from web searches (no accounts, no sandbox). Treat everything as a lead to verify with the
vendor, not as fact.

| Gateway | What the sources said | What is still unknown |
| --- | --- | --- |
| Paystack (ZA) | Supports South African merchants in ZAR. Split payments with subaccounts, by percentage or flat amount. Card pre-authorisation exists for businesses registered in South Africa, with a default hold of 5 days. Settlement timing depends on the merchant agreement. | Whether pre-authorisation holds are long enough for a job that finishes days after booking (5 days is short). Whether payouts to subaccounts can be delayed until Pebble says so. Provider onboarding and verification rules. EFT support. Fees. |
| PayFast (ZA) | Split Payments exist, but a third-party note says the other party must also be a PayFast merchant, and the split happens straight away. No confirmed hold or escrow. | Everything about holding and later releasing money. Providers would each need a PayFast account. This looks like a poor fit for delayed payouts. |
| Peach Payments (ZA, KE, MU) | A review site lists split payments as a feature. Next-business-day settlement claim from 2022. | Marketplace and sub-merchant model, delayed payouts, payout API, onboarding, fees. No official documentation found. |
| Stripe Connect | Sources conflict on whether South African platforms and accounts are supported. | Whether a South African platform can use Connect at all today. Treat as unconfirmed. |
| Ozow, Yoco | Nothing relevant found. | Everything. |

## Recommendation

1. Do not choose yet. No gateway has been confirmed to support "collect, hold until the customer confirms, then
   pay the provider".
2. Shortlist Paystack and Peach Payments. Paystack has the clearest public documentation for splits and
   pre-authorisation in South Africa. Peach is a local company and may be more flexible on a marketplace
   arrangement, but I found no public documentation, so it needs a conversation.
3. Drop PayFast for this use unless they confirm a hold-and-release flow.
4. Ask each shortlisted vendor the same questions in writing:
   - Can we collect now and release the provider's share later, after our own confirmation step? For how long
     can funds be held, and is it a card pre-authorisation or settled money?
   - Can we pay a provider on a schedule we control, and cancel or reduce that payout before it is sent?
   - How are partial refunds and refunds after a payout handled? Who carries the loss?
   - What does onboarding a sole-trader provider need (documents, time, fees)?
   - What are the fees per card, per EFT, per payout and per refund?
   - How are webhooks signed, and is there a replay protection window?
   - What is the compliance position for a platform that holds funds for third parties?
5. If a gateway only supports instant splits, the fallback is to collect to Pebble's own gateway account and pay
   providers by a separate payout once a job is confirmed. That needs the legal advice above.

## What the app already does to be ready

- Booking and payment state are separate columns: `status`, `payment_status`, `payout_status`.
- A payout can only become eligible after the customer confirms or 24 hours pass, and never for a cancelled job.
- A disputed job's payout is held and nothing releases it automatically.
- `record_payment_event` is the only way a payment changes a booking. It refuses to run until the gateway is marked
  ready, ignores a repeated event, never confirms a booking on a failed, late or wrong-amount payment (it flags
  those for a refund), and stores the processing fee on `payments` separately from `earning_cents`.
- It is callable only by the service role, so a future webhook route must verify the gateway's signature first.
- `admin_set_setting` cannot switch payments on unless the database owner has set `gateway_ready`.

## Sources

- Paystack card pre-authorisation: https://paystack.com/docs/payments/card-preauthorization/
- Paystack support article on pre-authorisation: https://support.paystack.com/en/articles/10450882
- PayFast on split payments: https://payfast.io/?p=6563
- Third-party guide to PayFast split payments: https://www.cmarix.com/blog/build-marketplace-payment-solution-with-payfast-split-payments/
- Peach Payments review listing (split payments mentioned): https://www.g2.com/products/peach-payments/reviews
- Stripe Connect overview: https://docs.stripe.com/connect/overview
