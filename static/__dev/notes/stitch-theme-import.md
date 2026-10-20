# Stitch theme import
MERCHANT NAVY BUSINESS THEME: /partner restaurant dashboard uses navy #1E2440 sidebar/header/bottom nav, #F1F3F7 content, white cards (#E3E6EE border), yellow primary w/ navy text, mint #6EE7B7 active accents. Scoped via global class `merchantNavy` on MerchantDashboard root; MerchantUi overrides only under `:global(.merchantNavy)` (shared with rider — rider stays light). ZiptoLogo tone="light" on navy surfaces.

CUSTOMER DARK THEME (Oct 2026): logged-in customers (role user, not /login) get body classes `platr-dark` + `dark` (toggled in AppShell useEffect). base.css `.platr-dark` overrides colour tokens to the LaunchingSoonHome palette (#0E1116 bg, #1A2028 card, yellow primary, --mint #6EE7B7). Customer-facing module CSS uses `:global(.platr-dark)` overrides; merchant/rider/admin/guest stay light. New customer UI must look right in both.
STATUS: base.css theme APPLIED (hybrid; new vars --teal, --teal-strong, --teal-soft, --emerald, --crimson, --teal-gradient, --glass-bg, --glass-blur). NEXT: redesign screens one by one, starting with home (_index) — confirm with user.

Zip file id: `18175124-0dac-4d50-a02f-8b076f815a03` (`stitch_platrfood_website_redesign.zip`). Read via `runCodeInBrowser` + JSZip; don't stage everything.

## Contents

- Three `DESIGN.md` files: `platr_alpine_fresh` is the customer/merchant theme. `alpine_telemetry` and `high_sunlight_alpine_cockpit` are dark rider themes and were **not chosen**.
- Described as 15 screens, each with `code.html` and `screen.png`: `platr_uttarakhand_food_delivery` (home), `restaurant_partner_registration_1/2`, `restaurant_partner_kyc_menu_upload_1/2`, `step_3_go_live_verification_1/2`, `restaurant_partner_dashboard_platr_merchant`, `pahadi_rasoi_menu_order` (restaurant menu), `cart_checkout_platr_friday_deals`, `live_order_tracking_hill_rider_map`, `order_cancellation_refund`, `refund_processed_confirmation`, `alpine_karma_points_rewards`, and rider screens `rider_partner_duty_dashboard` / `hill_dispatch` / `sunlight_mode` / `night_mode_toggle`. The supplied screen count and list should be reconciled when inspecting the zip. Karma points do not exist in the product; ask before building them.

## User decisions

- **Colours:** Hybrid. Keep Platr yellow `#FFC400` as primary, ink `#111`, and red `#E53935` as an accent. Add Stitch teal/emerald (`#0D9488` / `#10B981`; Stitch primary `#00685f`, container `#008378`) as secondary/success colours.
- **Surfaces:** Use Stitch background `#faf8ff`, cards `#ffffff`, surface-container-low `#f2f3ff`, and outline-variant `#bcc9c6`.
- **Shape and effects:** Rounded corners—sm `.25rem`, default `.5rem`, md `.75rem`, lg `1rem`, xl `1.5rem`—with soft diffuse shadows and frosted-blur navigation bars.
- **Font:** Keep Inter, not Plus Jakarta Sans. Keep the existing `--text-*` tokens.
- **Rider:** Use the same theme as the rest of the app, not the dark telemetry theme.
- **Scope:** Apply the theme via `updateCssVariables` first, then redesign screens one by one to match Stitch layouts. Keep functionality and real data unchanged. Ignore Stitch placeholder content—including specific cities, prices, Friday deals, and karma points—unless the user confirms it.
- Use `lucide-react`, not Material Symbols. Never name competitors.