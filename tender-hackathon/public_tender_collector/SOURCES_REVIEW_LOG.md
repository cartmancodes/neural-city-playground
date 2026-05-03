# Sources Review Log

A source is **never used** by the collector until every section below is
completed for that source AND `review.approved` is flipped to `true` in
`sources.yaml`. The CLI's `check-source` command refuses any source missing
fields here.

Use one section per source. Append new sources at the end. Never edit a
historical entry — append a "Re-review YYYY-MM-DD" subsection instead.

---

## Template (copy this, fill in, do not delete it)

### `<source_id>` — `<source_name>`

- **Reviewer name:** _____
- **Reviewed on (UTC date, YYYY-MM-DD):** _____
- **Terms-of-service URL:** _____
- **ToS one-paragraph summary (paste below; quote critical phrases):**
  > _____
- **robots.txt (paste full contents fetched manually on review date):**
  ```
  _____
  ```
- **Allowed paths verified public (list 3 sample URLs you opened in a browser):**
  1. _____
  2. _____
  3. _____
- **Rate-limit decision and rationale:** _____
- **Approval line (sign):**
  > I have reviewed the ToS, robots.txt, and three sample public tender pages
  > on YYYY-MM-DD. The collector's intended use is consistent with the
  > published terms.
- **Approved by flipping `review.approved: true` in sources.yaml on:** _____

---

## Sources

(Empty — add the first reviewed source below.)
