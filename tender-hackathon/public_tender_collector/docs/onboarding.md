# Source Onboarding

A new tender portal cannot be collected from until **a human reviewer** has signed off on every step in this checklist and recorded it in [`SOURCES_REVIEW_LOG.md`](../SOURCES_REVIEW_LOG.md).

The collector enforces this at runtime — `python main.py check-source --source <id>` exits with code 3 if any field below is missing.

---

## Why a human reviewer

The collector refuses to evaluate ToS, robots.txt, or "is this URL really public" automatically. Those judgements are legal and contextual. A machine can't read the spirit of a portal's published terms; a reviewer can. The collector's role is to **honour** the reviewer's decision, never to replace it.

If your reviewer is uncertain about anything — a non-standard ToS, an ambiguous public/private boundary, a "no automated access" clause — the answer is **don't approve the source**. There is no rush. Hackathon timelines do not justify cutting this corner.

---

## The 7-step checklist

Open `SOURCES_REVIEW_LOG.md`. Copy the template into the "Sources" section. Fill in **every** field below; an incomplete log entry blocks `check-source`.

### 1. Reviewer identity

```markdown
- Reviewer name:        Jane Doe
- Reviewed on (UTC):    2026-05-04
```

The reviewer is an actual person, not a team. Pseudonyms are acceptable if the underlying identity is recoverable from your organisation's records.

### 2. Read the Terms of Service end-to-end

```markdown
- Terms-of-service URL:  https://portal.example.gov.in/terms
- ToS one-paragraph summary:
  > The portal publishes tender notices and corrigenda for general public
  > viewing. Users may download tender documents for the purpose of
  > preparing a bid. The portal does not explicitly grant or deny automated
  > download permission. No commercial reuse of the documents is permitted
  > without the procuring entity's consent.
```

Quote the critical phrases. If the ToS prohibits automated access, **do not approve the source.**

### 3. Manually fetch and paste robots.txt

Fetch with a normal browser or `curl`:

```bash
curl -s -H "User-Agent: ProcureIntelligenceAP-ResearchBot/0.2 (+contact: ops@example.com)" \
  https://portal.example.gov.in/robots.txt
```

Paste the **complete** body (or "no robots.txt — server returned 404"). Do not summarise.

```markdown
- robots.txt:
  ```
  User-agent: *
  Disallow: /admin/
  Disallow: /private/
  Crawl-delay: 10
  ```
```

If `Crawl-delay: N` is present, your `rate_limit_seconds` in `sources.yaml` must be ≥ N.

### 4. Verify allowed paths are public

Pick three sample URLs that match the `allowed_paths` prefixes in your draft `sources.yaml` entry. Open each in an **incognito/private** browser window with no cookies and no logged-in state. Confirm:

- The page renders without redirecting to a login.
- No CAPTCHA is presented.
- No "session expired" / "please log in" message appears.

```markdown
- Allowed paths verified public:
  1. https://portal.example.gov.in/eprocure/public/AbstractDirectLink?TenderID=12345
  2. https://portal.example.gov.in/eprocure/public/Notice?id=67890
  3. https://portal.example.gov.in/eprocure/public/Corrigendum?id=11111
```

If any of the three required login or CAPTCHA, **drop that path from `allowed_paths`** before approving.

### 5. Decide a rate limit (be generous)

Defaults from `config.yaml`:

```yaml
runtime:
  default_rate_limit_seconds: 5
```

Per-source override in `sources.yaml`:

```yaml
limits:
  rate_limit_seconds: 10  # >= robots Crawl-delay AND >= global default
```

Heuristics:

- robots `Crawl-delay: N` present → use `max(N, global_default, 8)` minimum.
- High-traffic central portal → 8–15 seconds.
- Smaller state portal → 15–30 seconds.
- "Looks fragile" — slow, occasional 5xx → 30–60 seconds.

```markdown
- Rate-limit decision and rationale:
  > robots `Crawl-delay: 10` present; portal also returns occasional 503 on
  > heavy days. Using 15s/request to keep load comfortably below the
  > published expectation.
```

### 6. Sign the approval line

```markdown
- Approval line (sign):
  > I have reviewed the ToS, robots.txt, and three sample public tender
  > pages on 2026-05-04. The collector's intended use is consistent with
  > the published terms.
```

This is a personal attestation. If your name and date are on it, your name and date are in the audit trail forever.

### 7. Flip `review.approved` to `true`

In `sources.yaml`:

```yaml
- source_id: my_new_source
  ...
  review:
    reviewed_by: "Jane Doe"
    reviewed_on: "2026-05-04"
    tos_url: "https://portal.example.gov.in/terms"
    tos_summary: "The portal publishes tender notices..."
    approved: true   # ← this line, last
```

Order matters: flip `approved` **last**, after every other field is filled in. The `check-source` command reads them all.

---

## Fields in `sources.yaml` (annotated)

```yaml
sources:
  - source_id: my_source              # snake_case, unique, stable across history
    source_name: "Human-readable name (with portal version if applicable)"
    base_url: "https://portal.example.gov.in"
    allowed_paths:                    # prefix allowlist; subdomain drift is forbidden
      - "/eprocure/public/"
      - "/eprocure/app/"

    source_type: official_portal       # official_portal | public_search_page | bulk_download | manual_url_list
    country: IN
    state: AP                          # null for central
    department: null
    languages: [en, te]                # for AP we expect bilingual; the language guesser confirms

    parser_name: cppp_parser           # one of: cppp | gepnic | state_portal | epublish

    discovery:
      mode: manual_seed                # manual_seed | search_page | sitemap
      sitemap_url: null                # required only when mode == sitemap
      search_pages: []                 # the START URLs for search-page traversal

    limits:
      rate_limit_seconds: 15           # >= global default; per-source can be stricter only
      max_pages_per_run: 10            # hard cap, never bypassable
      max_documents_per_run: 50

    allowed_file_extensions:
      [pdf, doc, docx, xls, xlsx, zip] # narrow this if the portal only publishes PDFs

    robots_required: true              # set false ONLY if the source is manual_url_list

    review:
      reviewed_by: "Jane Doe"
      reviewed_on: "2026-05-04"
      tos_url: "https://portal.example.gov.in/terms"
      tos_summary: "..."               # paragraph summary
      approved: true                   # last to flip
    notes: "..."
```

**Rules the collector enforces against this config:**

- `host(base_url) == host(every URL)` — no subdomain drift.
- `URL.path` must start with one of `allowed_paths`.
- `URL.path` must not contain any of `compliance.blocked_path_substrings` (login, signin, signup, register, dashboard, api/internal, secure, auth, oauth, sso, captcha, submit-bid, my-bids, payment, checkout).
- File extensions outside `allowed_file_extensions` are skipped before fetching.
- The per-source / per-run page and document caps are checked on every URL.

---

## Re-review

Anything that changes the portal's published terms, robots.txt, or URL surface area requires a re-review. **Don't edit historical entries.** Append a new dated subsection in `SOURCES_REVIEW_LOG.md`:

```markdown
### Re-review 2026-08-01 — `my_source`

- Reviewer: Jane Doe
- Reason: portal updated robots.txt; Crawl-delay increased from 10 to 30.
- Action: bumped `rate_limit_seconds` to 35.
- Approval line: > I have re-reviewed the ToS and robots.txt on 2026-08-01...
```

If the reason for re-review is a CAPTCHA challenge, a new login wall, or a "no automated access" clause, **flip `approved: false`** and stop using the source.

---

## What about a source we built a parser for but haven't approved yet?

The repository ships with parsers for four portal families (CPPP, GePNIC, AP-style state portal, ePublish) and `sources.yaml` ships with example unapproved entries pointing at `*.gov.invalid`. You can write tests against those parsers (the `tests/fixtures/html/` directory is full of offline fixtures) without ever activating the portal. The collector will refuse to run against them at the CLI level until a reviewer has signed off.

That separation is intentional: code can ship faster than legal review, and the runtime gate keeps the two from drifting.
