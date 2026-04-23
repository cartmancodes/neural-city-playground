import {
  Badge,
  Kpi,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
} from "@/components/ui/primitives";
import { getProductIntel } from "@/lib/data";
import { formatINR, formatNumber, formatPct } from "@/lib/format";

function shortName(code: string, max = 40) {
  const clean = code.replace(/^\d+\s*-\s*/, "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function supplierTypeTone(t: string | null | undefined) {
  if (t === "Local") return "info" as const;
  if (t === "Non-Local") return "accent" as const;
  return "neutral" as const;
}

function brandTypeTone(t: string | null | undefined) {
  if (t === "IML") return "info" as const;
  if (t === "BEER") return "warn" as const;
  return "neutral" as const;
}

function gapTone(direction: string) {
  if (direction === "under-represented") return "warn" as const;
  if (direction === "over-represented") return "accent" as const;
  return "ok" as const;
}

export default async function ProductsPage() {
  const pi = await getProductIntel();

  // ------- Price-band × pack-bucket heatmap (existing) -------
  const priceBands = Array.from(new Set(pi.price_band_pack_matrix.map((x) => x.price_band)));
  const packBuckets = Array.from(new Set(pi.price_band_pack_matrix.map((x) => x.pack_bucket)));
  const matrix: Record<string, Record<string, number>> = {};
  priceBands.forEach((pb) => {
    matrix[pb] = {};
    packBuckets.forEach((pk) => {
      matrix[pb][pk] = 0;
    });
  });
  pi.price_band_pack_matrix.forEach(({ price_band, pack_bucket, sku_count }) => {
    matrix[price_band][pack_bucket] = (matrix[price_band][pack_bucket] || 0) + sku_count;
  });
  const maxCell = Math.max(
    1,
    ...priceBands.flatMap((pb) => packBuckets.map((pk) => matrix[pb][pk])),
  );

  const topCats = Object.entries(pi.category_distribution).sort(([, a], [, b]) => b - a).slice(0, 10);

  // ------- Label activity — monthly stacked new vs renewal -------
  const timeline = pi.label_activity_timeline;
  const tMax = Math.max(1, ...timeline.map((t) => t.total));

  // ------- Outlet fit grid (vendor_type × price_band) -------
  const vendorTypes = Array.from(new Set(pi.outlet_fit_profile.map((x) => x.vendor_type)));
  const fitBands = ["Economy", "Value", "Premium", "Luxury"];
  const fitBy = new Map<string, (typeof pi.outlet_fit_profile)[number]>();
  pi.outlet_fit_profile.forEach((x) => fitBy.set(`${x.vendor_type}|${x.price_band}`, x));

  return (
    <>
      <PageHeader
        eyebrow="Product & Assortment"
        title="Brand · Label · Assortment Intelligence"
        description={pi.tag}
        action={
          <Badge tone="info">
            {pi.totals.sku_total} SKUs · {pi.totals.brand_total} brands · {pi.totals.supplier_total} suppliers · {pi.totals.distillery_total} distilleries
          </Badge>
        }
      />

      {/* Principle banner — makes sales vs proxy distinction explicit */}
      <div className="mb-6 rounded-md border hairline bg-gradient-to-r from-accent-500/10 to-teal-500/5 p-4">
        <div className="flex items-start gap-3">
          <Badge tone="accent">principle</Badge>
          <div className="flex-1">
            <p className="text-sm text-ink-100 font-medium">{pi.principle}</p>
            <p className="text-2xs text-ink-400 mt-1">{pi.proxy_disclaimer}</p>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <Kpi label="SKU catalog" value={formatNumber(pi.totals.sku_total)} hint="active product codes" tone="neutral" />
        <Kpi label="Brands" value={formatNumber(pi.totals.brand_total)} hint="distinct brand codes" tone="neutral" />
        <Kpi label="Suppliers" value={formatNumber(pi.totals.supplier_total)} hint="local + non-local" tone="accent" />
        <Kpi label="Distilleries" value={formatNumber(pi.totals.distillery_total)} hint="production units" tone="accent" />
        <Kpi
          label="New labels · 90d"
          value={formatNumber(pi.totals.recent_90d_new_labels)}
          hint={`${pi.totals.new_labels_total} cumulative`}
          tone="warn"
        />
        <Kpi
          label="Renewals · cumulative"
          value={formatNumber(pi.totals.renewal_total)}
          hint="stable incumbent signal"
          tone="neutral"
        />
      </div>

      {/* =============================================================== */}
      {/* SECTION A — FORWARD SIGNALS (label-based)                        */}
      {/* =============================================================== */}
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-ink-100 uppercase tracking-wider">Forward signals — label approvals</h2>
        <Badge tone="accent">proxy · forward-looking</Badge>
      </div>

      <Panel className="mb-4">
        <PanelHeader
          title="Label activity over time"
          hint="New launches vs Old Label renewals · new labels are a proxy for supplier expectations of future demand"
        />
        <PanelBody className="overflow-x-auto">
          <div className="flex items-end gap-1 min-h-[180px] pt-2">
            {timeline.map((m) => {
              const newPct = m.total ? (m.new_labels / tMax) * 100 : 0;
              const renPct = m.total ? (m.renewals / tMax) * 100 : 0;
              return (
                <div key={m.ym} className="flex-1 min-w-[28px] flex flex-col items-center gap-1 group">
                  <div className="w-full flex flex-col justify-end h-[160px] relative">
                    <div
                      className="w-full bg-accent-500 rounded-t-sm"
                      style={{ height: `${newPct}%` }}
                      title={`${m.ym}: ${m.new_labels} new`}
                    />
                    <div
                      className="w-full bg-teal-600"
                      style={{ height: `${renPct}%` }}
                      title={`${m.ym}: ${m.renewals} renewals`}
                    />
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-2xs text-ink-200 opacity-0 group-hover:opacity-100 transition">
                      {m.total}
                    </div>
                  </div>
                  <div className="text-2xs text-ink-500 rotate-45 origin-top-left whitespace-nowrap">
                    {m.ym.slice(2)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-8 flex items-center gap-4 text-2xs text-ink-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-accent-500" /> new labels (forward signal)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-teal-600" /> renewals (incumbent stability)
            </span>
          </div>
        </PanelBody>
      </Panel>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <Panel>
          <PanelHeader
            title="Supplier aggression index"
            hint="Weighted: new labels · pack-size breadth · brand breadth · activity frequency · last 180d"
          />
          <div className="overflow-x-auto max-h-[440px]">
            <table className="w-full text-xs tabular">
              <thead className="sticky top-0 bg-ink-950/90 backdrop-blur">
                <tr className="text-ink-400 text-2xs uppercase tracking-wider border-b hairline">
                  <th className="text-left px-3 py-2 font-medium">Distillery</th>
                  <th className="text-right px-3 py-2 font-medium">New</th>
                  <th className="text-right px-3 py-2 font-medium">Renewal</th>
                  <th className="text-right px-3 py-2 font-medium">Packs</th>
                  <th className="text-right px-3 py-2 font-medium">Brands</th>
                  <th className="text-left px-3 py-2 font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {pi.supplier_aggression.map((r, i) => (
                  <tr key={i} className="border-b hairline hover:bg-ink-800/40">
                    <td className="px-3 py-2 text-ink-100 max-w-[240px]" title={r.distillery}>
                      {shortName(r.distillery, 34)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Badge tone="accent">{r.new_labels_180d}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right text-ink-300">{r.renewals_180d}</td>
                    <td className="px-3 py-2 text-right text-ink-200">{r.pack_sizes_touched}</td>
                    <td className="px-3 py-2 text-right text-ink-200">{r.brands_touched}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 rounded-full bg-ink-800 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-accent-500 to-warn"
                            style={{ width: `${Math.min(100, r.aggression_score * 100)}%` }}
                          />
                        </div>
                        <span className="text-2xs text-ink-100 tabular">
                          {r.aggression_score.toFixed(2)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Overcrowded product segments"
            hint="Category × price-band with too many SKUs chasing too few brands — cannibalization risk"
          />
          <div className="overflow-x-auto max-h-[440px]">
            <table className="w-full text-xs tabular">
              <thead className="sticky top-0 bg-ink-950/90 backdrop-blur">
                <tr className="text-ink-400 text-2xs uppercase tracking-wider border-b hairline">
                  <th className="text-left px-3 py-2 font-medium">Category</th>
                  <th className="text-left px-3 py-2 font-medium">Price band</th>
                  <th className="text-right px-3 py-2 font-medium">SKUs</th>
                  <th className="text-right px-3 py-2 font-medium">Brands</th>
                  <th className="text-right px-3 py-2 font-medium">Suppliers</th>
                  <th className="text-right px-3 py-2 font-medium">Density</th>
                </tr>
              </thead>
              <tbody>
                {pi.overcrowded_segments.map((r, i) => (
                  <tr key={i} className="border-b hairline hover:bg-ink-800/40">
                    <td className="px-3 py-2 text-ink-100 max-w-[180px] truncate" title={r.category}>
                      {r.category}
                    </td>
                    <td className="px-3 py-2 text-ink-200">{r.price_band}</td>
                    <td className="px-3 py-2 text-right text-ink-100">{r.sku_count}</td>
                    <td className="px-3 py-2 text-right text-ink-200">{r.brand_count}</td>
                    <td className="px-3 py-2 text-right text-ink-200">{r.supplier_count}</td>
                    <td className="px-3 py-2 text-right">
                      <Badge tone={r.density_score > 2.0 ? "warn" : "neutral"}>
                        {r.density_score.toFixed(2)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <Panel>
          <PanelHeader
            title="Emerging brands to watch"
            hint="Brands whose recent label activity is mostly new (≥50% new share) — upcoming launches"
          />
          <div className="overflow-x-auto max-h-[400px]">
            <table className="w-full text-xs tabular">
              <thead className="sticky top-0 bg-ink-950/90 backdrop-blur">
                <tr className="text-ink-400 text-2xs uppercase tracking-wider border-b hairline">
                  <th className="text-left px-3 py-2 font-medium">Brand</th>
                  <th className="text-right px-3 py-2 font-medium">New</th>
                  <th className="text-right px-3 py-2 font-medium">Packs</th>
                  <th className="text-right px-3 py-2 font-medium">New share</th>
                  <th className="text-left px-3 py-2 font-medium">Last approval</th>
                </tr>
              </thead>
              <tbody>
                {pi.emerging_brands.map((b, i) => (
                  <tr key={i} className="border-b hairline hover:bg-ink-800/40">
                    <td className="px-3 py-2 text-ink-100 truncate max-w-[260px]" title={b.brand_name}>
                      {b.brand_name}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Badge tone="accent">{b.new_labels}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right text-ink-200">{b.pack_sizes}</td>
                    <td className="px-3 py-2 text-right text-ink-100">
                      {formatPct(b.new_share, 0)}
                    </td>
                    <td className="px-3 py-2 text-ink-300 text-2xs">
                      {b.last_approval ? b.last_approval.slice(0, 10) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Renewal-heavy brands — stable incumbents"
            hint="Mostly old-label renewals — predictable, defendable catalog anchors"
          />
          <div className="overflow-x-auto max-h-[400px]">
            {pi.renewal_heavy_brands.length === 0 ? (
              <div className="text-xs text-ink-400 px-3 py-6">
                No strong renewal-only clusters in the current window (≥2 renewals &amp; ≤33% new share).
              </div>
            ) : (
              <table className="w-full text-xs tabular">
                <thead className="sticky top-0 bg-ink-950/90 backdrop-blur">
                  <tr className="text-ink-400 text-2xs uppercase tracking-wider border-b hairline">
                    <th className="text-left px-3 py-2 font-medium">Brand</th>
                    <th className="text-right px-3 py-2 font-medium">Renewals</th>
                    <th className="text-right px-3 py-2 font-medium">Distilleries</th>
                    <th className="text-right px-3 py-2 font-medium">New share</th>
                    <th className="text-left px-3 py-2 font-medium">Last approval</th>
                  </tr>
                </thead>
                <tbody>
                  {pi.renewal_heavy_brands.map((b, i) => (
                    <tr key={i} className="border-b hairline hover:bg-ink-800/40">
                      <td className="px-3 py-2 text-ink-100 truncate max-w-[260px]" title={b.brand_name}>
                        {b.brand_name}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Badge tone="info">{b.renewals}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right text-ink-200">{b.distilleries}</td>
                      <td className="px-3 py-2 text-right text-ink-300">
                        {formatPct(b.new_share, 0)}
                      </td>
                      <td className="px-3 py-2 text-ink-300 text-2xs">
                        {b.last_approval ? b.last_approval.slice(0, 10) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Panel>
      </div>

      <Panel className="mb-8">
        <PanelHeader
          title="Pack-size proliferation"
          hint="Same brand spread across ≥3 pack sizes — pruning candidates in low-throughput outlets"
        />
        <div className="overflow-x-auto max-h-[360px]">
          <table className="w-full text-xs tabular">
            <thead className="sticky top-0 bg-ink-950/90 backdrop-blur">
              <tr className="text-ink-400 text-2xs uppercase tracking-wider border-b hairline">
                <th className="text-left px-3 py-2 font-medium">Brand</th>
                <th className="text-left px-3 py-2 font-medium">Type</th>
                <th className="text-right px-3 py-2 font-medium">Pack sizes</th>
                <th className="text-right px-3 py-2 font-medium">SKUs</th>
                <th className="text-right px-3 py-2 font-medium">Distilleries</th>
                <th className="text-left px-3 py-2 font-medium">Sizes (ml)</th>
              </tr>
            </thead>
            <tbody>
              {pi.pack_proliferation.map((r, i) => (
                <tr key={i} className="border-b hairline hover:bg-ink-800/40">
                  <td className="px-3 py-2 text-ink-100 truncate max-w-[280px]" title={r.brand_name}>
                    {r.brand_name}
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={brandTypeTone(r.brand_type)}>{r.brand_type ?? "—"}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Badge tone={r.pack_sizes >= 5 ? "warn" : "neutral"}>{r.pack_sizes}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right text-ink-100">{r.sku_count}</td>
                  <td className="px-3 py-2 text-right text-ink-200">{r.distilleries}</td>
                  <td className="px-3 py-2 text-ink-300 text-2xs">{r.pack_list.join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* =============================================================== */}
      {/* SECTION B — STRUCTURAL BRAND & SUPPLIER INTELLIGENCE             */}
      {/* =============================================================== */}
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-ink-100 uppercase tracking-wider">Structural — brand & supplier master</h2>
        <Badge tone="info">master data</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-4">
        <Panel>
          <PanelHeader title="Brand type mix" hint="IML · BEER · other" />
          <PanelBody>
            <div className="space-y-2">
              {pi.brand_type_mix.map((r) => {
                const maxSku = Math.max(...pi.brand_type_mix.map((x) => x.sku_count));
                return (
                  <div key={String(r.brand_type)} className="flex items-center gap-3">
                    <Badge tone={brandTypeTone(r.brand_type)}>{r.brand_type ?? "—"}</Badge>
                    <div className="flex-1 h-2 bg-ink-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-600 to-blue-500"
                        style={{ width: `${(r.sku_count / maxSku) * 100}%` }}
                      />
                    </div>
                    <div className="text-xs tabular text-ink-100 w-24 text-right">
                      {formatNumber(r.sku_count)} SKUs
                    </div>
                    <div className="text-2xs tabular text-ink-400 w-20 text-right">
                      {formatNumber(r.brand_count)} brands
                    </div>
                  </div>
                );
              })}
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Supplier type mix" hint="Local vs Non-Local sourcing" />
          <PanelBody>
            <div className="space-y-2">
              {pi.supplier_type_mix.map((r) => {
                const maxSku = Math.max(...pi.supplier_type_mix.map((x) => x.sku_count));
                return (
                  <div key={String(r.supplier_type)} className="flex items-center gap-3">
                    <Badge tone={supplierTypeTone(r.supplier_type)}>{r.supplier_type ?? "—"}</Badge>
                    <div className="flex-1 h-2 bg-ink-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-teal-600 to-teal-500"
                        style={{ width: `${(r.sku_count / maxSku) * 100}%` }}
                      />
                    </div>
                    <div className="text-xs tabular text-ink-100 w-20 text-right">
                      {formatNumber(r.sku_count)} SKUs
                    </div>
                    <div className="text-2xs tabular text-ink-400 w-24 text-right">
                      {formatNumber(r.supplier_count)} suppliers
                    </div>
                  </div>
                );
              })}
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Price band × brand type" hint="SKU count by price tier" />
          <PanelBody>
            <div className="space-y-1.5">
              {pi.price_band_by_brand_type
                .slice()
                .sort((a, b) => b.sku_count - a.sku_count)
                .map((r, i) => {
                  const max = Math.max(...pi.price_band_by_brand_type.map((x) => x.sku_count));
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <Badge tone={brandTypeTone(r.brand_type)}>{r.brand_type ?? "—"}</Badge>
                      <div className="text-2xs text-ink-300 w-16">{r.price_band}</div>
                      <div className="flex-1 h-1.5 bg-ink-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent-500"
                          style={{ width: `${(r.sku_count / max) * 100}%` }}
                        />
                      </div>
                      <div className="text-2xs tabular text-ink-100 w-12 text-right">
                        {r.sku_count}
                      </div>
                    </div>
                  );
                })}
            </div>
          </PanelBody>
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <Panel className="xl:col-span-2">
          <PanelHeader
            title="Price band × pack size — SKU density heatmap"
            hint="Bright cells = crowded zones · rationalization candidates live here"
          />
          <PanelBody className="overflow-x-auto">
            <table className="w-full text-xs tabular">
              <thead>
                <tr>
                  <th className="text-left px-2 py-2 text-ink-400 text-2xs uppercase tracking-wider">Price band</th>
                  {packBuckets.map((pk) => (
                    <th key={pk} className="px-2 py-2 text-ink-400 text-2xs uppercase tracking-wider text-center">
                      {pk}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {priceBands.map((pb) => (
                  <tr key={pb}>
                    <td className="px-2 py-2 font-medium text-ink-100">{pb}</td>
                    {packBuckets.map((pk) => {
                      const v = matrix[pb][pk];
                      const intensity = v / maxCell;
                      return (
                        <td key={pk} className="px-1 py-1">
                          <div
                            className="h-9 rounded-md flex items-center justify-center font-medium"
                            style={{
                              background: `rgba(245, 158, 11, ${0.07 + intensity * 0.8})`,
                              color: intensity > 0.5 ? "#05080f" : "#e5e7eb",
                            }}
                            title={`${pb} · ${pk} · ${v} SKUs`}
                          >
                            {v || ""}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Category distribution" hint="Top 10 product categories in master" />
          <PanelBody>
            <div className="space-y-2">
              {topCats.map(([cat, count]) => (
                <div key={cat} className="flex items-center gap-3">
                  <div className="text-xs text-ink-200 w-28 truncate">{cat}</div>
                  <div className="flex-1 h-2 bg-ink-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-teal-600 to-teal-500"
                      style={{ width: `${(count / (topCats[0][1] as number)) * 100}%` }}
                    />
                  </div>
                  <div className="w-10 text-right text-xs tabular text-ink-100">{count}</div>
                </div>
              ))}
            </div>
          </PanelBody>
        </Panel>
      </div>

      <Panel className="mb-4">
        <PanelHeader
          title="Brand leaderboard"
          hint="Top brands by SKU spread · type, MRP range, price bands and pack sizes covered"
        />
        <div className="overflow-x-auto max-h-[480px]">
          <table className="w-full text-xs tabular">
            <thead className="sticky top-0 bg-ink-950/90 backdrop-blur">
              <tr className="text-ink-400 text-2xs uppercase tracking-wider border-b hairline">
                <th className="text-left px-3 py-2 font-medium">Brand</th>
                <th className="text-left px-3 py-2 font-medium">Type</th>
                <th className="text-right px-3 py-2 font-medium">SKUs</th>
                <th className="text-right px-3 py-2 font-medium">Suppliers</th>
                <th className="text-right px-3 py-2 font-medium">Distilleries</th>
                <th className="text-right px-3 py-2 font-medium">Mean MRP</th>
                <th className="text-right px-3 py-2 font-medium">MRP range</th>
                <th className="text-left px-3 py-2 font-medium">Price bands</th>
                <th className="text-left px-3 py-2 font-medium">Pack sizes</th>
              </tr>
            </thead>
            <tbody>
              {pi.brand_leaderboard.map((b, i) => (
                <tr key={i} className="border-b hairline hover:bg-ink-800/40">
                  <td className="px-3 py-2 text-ink-100 truncate max-w-[260px]" title={b.brand_name}>
                    {b.brand_name}
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={brandTypeTone(b.brand_type)}>{b.brand_type ?? "—"}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right text-ink-100">{b.sku_count}</td>
                  <td className="px-3 py-2 text-right text-ink-200">{b.supplier_count}</td>
                  <td className="px-3 py-2 text-right text-ink-200">{b.distillery_count}</td>
                  <td className="px-3 py-2 text-right text-ink-100">
                    {b.mean_mrp != null ? formatINR(b.mean_mrp) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-ink-300 text-2xs">
                    {b.min_mrp != null && b.max_mrp != null
                      ? `${formatINR(b.min_mrp)} – ${formatINR(b.max_mrp)}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-ink-300 text-2xs max-w-[200px] truncate" title={b.price_bands}>
                    {b.price_bands || "—"}
                  </td>
                  <td className="px-3 py-2 text-ink-300 text-2xs max-w-[240px] truncate" title={b.pack_buckets}>
                    {b.pack_buckets || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-8">
        <Panel>
          <PanelHeader
            title="Top suppliers by SKU footprint"
            hint="Who brings in how many brands & SKUs · sourcing type · top category"
          />
          <div className="overflow-x-auto max-h-[440px]">
            <table className="w-full text-xs tabular">
              <thead className="sticky top-0 bg-ink-950/90 backdrop-blur">
                <tr className="text-ink-400 text-2xs uppercase tracking-wider border-b hairline">
                  <th className="text-left px-3 py-2 font-medium">Supplier</th>
                  <th className="text-left px-3 py-2 font-medium">Type</th>
                  <th className="text-right px-3 py-2 font-medium">Brands</th>
                  <th className="text-right px-3 py-2 font-medium">SKUs</th>
                  <th className="text-right px-3 py-2 font-medium">Distilleries</th>
                  <th className="text-right px-3 py-2 font-medium">Mean MRP</th>
                  <th className="text-left px-3 py-2 font-medium">Top category</th>
                </tr>
              </thead>
              <tbody>
                {pi.supplier_footprint.map((s, i) => (
                  <tr key={i} className="border-b hairline hover:bg-ink-800/40">
                    <td className="px-3 py-2 text-ink-100 max-w-[240px]" title={s.supplier_code}>
                      {shortName(s.supplier_code, 34)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={supplierTypeTone(s.supplier_type)}>{s.supplier_type ?? "—"}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right text-ink-200">{s.brand_count}</td>
                    <td className="px-3 py-2 text-right text-ink-100">{s.sku_count}</td>
                    <td className="px-3 py-2 text-right text-ink-200">{s.distillery_count}</td>
                    <td className="px-3 py-2 text-right text-ink-100">
                      {s.mean_mrp != null ? formatINR(s.mean_mrp) : "—"}
                    </td>
                    <td className="px-3 py-2 text-ink-300 text-2xs truncate max-w-[140px]" title={s.top_category}>
                      {s.top_category}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Top distilleries"
            hint="Production side · brands, SKUs, suppliers, recent label activity (90d)"
          />
          <div className="overflow-x-auto max-h-[440px]">
            <table className="w-full text-xs tabular">
              <thead className="sticky top-0 bg-ink-950/90 backdrop-blur">
                <tr className="text-ink-400 text-2xs uppercase tracking-wider border-b hairline">
                  <th className="text-left px-3 py-2 font-medium">Distillery</th>
                  <th className="text-right px-3 py-2 font-medium">Brands</th>
                  <th className="text-right px-3 py-2 font-medium">SKUs</th>
                  <th className="text-right px-3 py-2 font-medium">Suppliers</th>
                  <th className="text-right px-3 py-2 font-medium">Mean MRP</th>
                  <th className="text-right px-3 py-2 font-medium">Recent / new · 90d</th>
                </tr>
              </thead>
              <tbody>
                {pi.distillery_footprint.map((d, i) => (
                  <tr key={i} className="border-b hairline hover:bg-ink-800/40">
                    <td className="px-3 py-2 text-ink-100 max-w-[240px]" title={d.distillery}>
                      {shortName(d.distillery, 34)}
                    </td>
                    <td className="px-3 py-2 text-right text-ink-200">{d.brand_count}</td>
                    <td className="px-3 py-2 text-right text-ink-100">{d.sku_count}</td>
                    <td className="px-3 py-2 text-right text-ink-200">{d.supplier_count}</td>
                    <td className="px-3 py-2 text-right text-ink-100">
                      {d.mean_mrp != null ? formatINR(d.mean_mrp) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {d.recent_labels_90d > 0 ? (
                        <span className="text-2xs tabular">
                          <Badge tone="accent">{d.recent_labels_90d}</Badge>{" "}
                          <span className="text-ink-400">/ {d.recent_new_90d} new</span>
                        </span>
                      ) : (
                        <span className="text-ink-400 text-2xs">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* =============================================================== */}
      {/* SECTION C — BRAND-TO-OUTLET FIT (prior-based)                    */}
      {/* =============================================================== */}
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-ink-100 uppercase tracking-wider">Brand-to-outlet fit</h2>
        <Badge tone="warn">inferred · priors</Badge>
      </div>

      <Panel className="mb-8">
        <PanelHeader
          title="Expected assortment profile by outlet type"
          hint="Priors by vendor_type (A4 / Bars / Clubs / Tourism) vs catalog-wide price-band mix · green = aligned, amber = mismatch"
        />
        <PanelBody className="overflow-x-auto">
          <table className="w-full text-xs tabular">
            <thead>
              <tr className="text-ink-400 text-2xs uppercase tracking-wider border-b hairline">
                <th className="text-left px-3 py-2 font-medium">Outlet type</th>
                <th className="text-right px-3 py-2 font-medium">Outlets</th>
                <th className="text-right px-3 py-2 font-medium">30d revenue</th>
                {fitBands.map((b) => (
                  <th key={b} className="text-center px-3 py-2 font-medium">
                    {b}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendorTypes.map((vt) => {
                const row = pi.outlet_fit_profile.find((x) => x.vendor_type === vt);
                return (
                  <tr key={vt} className="border-b hairline align-top">
                    <td className="px-3 py-3 text-ink-100 font-medium">{vt}</td>
                    <td className="px-3 py-3 text-right text-ink-200">
                      {row ? formatNumber(row.outlets) : "—"}
                    </td>
                    <td className="px-3 py-3 text-right text-ink-100">
                      {row ? formatINR(row.revenue_30d) : "—"}
                    </td>
                    {fitBands.map((band) => {
                      const cell = fitBy.get(`${vt}|${band}`);
                      if (!cell) return <td key={band} className="px-3 py-3 text-center text-ink-500">—</td>;
                      return (
                        <td key={band} className="px-3 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Badge tone={gapTone(cell.direction)}>
                              {cell.direction === "aligned" ? "≈ aligned" : cell.direction === "under-represented" ? "under" : "over"}
                            </Badge>
                            <div className="text-2xs text-ink-300 tabular">
                              target {formatPct(cell.target_pct, 0)} · catalog {formatPct(cell.catalog_pct, 0)}
                            </div>
                            <div className={`text-2xs tabular ${cell.gap_pct < 0 ? "text-warn" : cell.gap_pct > 0 ? "text-accent-400" : "text-ink-500"}`}>
                              {cell.gap_pct > 0 ? "+" : ""}{formatPct(cell.gap_pct, 1)}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-2xs text-ink-400 leading-relaxed max-w-3xl">
            Priors: Bars &amp; Tourism skew Premium/Luxury; Clubs skew Premium; A4 skews Economy/Value.
            Gap = catalog mix − expected. Negative gap = segment is <span className="text-warn">under-represented</span> for that outlet
            type → push opportunity. Positive gap = <span className="text-accent-400">over-represented</span> → likely cannibalization risk.
          </p>
        </PanelBody>
      </Panel>

      {/* =============================================================== */}
      {/* SECTION D — PROXY RATIONALIZATION                                */}
      {/* =============================================================== */}
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-ink-100 uppercase tracking-wider">Proxy rationalization</h2>
        <Badge tone="warn">rule-based · to be enhanced with SKU-level sales</Badge>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <Panel>
          <PanelHeader
            title="Rationalization candidates"
            hint="Same brand × pack with ≥3 SKUs · scored by (sku + suppliers + price spread)"
          />
          <div className="overflow-x-auto max-h-[440px]">
            <table className="w-full text-xs tabular">
              <thead className="sticky top-0 bg-ink-950/90 backdrop-blur">
                <tr className="text-ink-400 text-2xs uppercase tracking-wider border-b hairline">
                  <th className="text-left px-3 py-2 font-medium">Brand</th>
                  <th className="text-left px-3 py-2 font-medium">Pack</th>
                  <th className="text-right px-3 py-2 font-medium">SKUs</th>
                  <th className="text-right px-3 py-2 font-medium">Suppliers</th>
                  <th className="text-right px-3 py-2 font-medium">Spread ₹</th>
                  <th className="text-right px-3 py-2 font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {pi.rationalization_candidates.slice(0, 25).map((r, i) => (
                  <tr key={i} className="border-b hairline hover:bg-ink-800/40">
                    <td className="px-3 py-2 text-ink-100 truncate max-w-[240px]" title={r.brand_name}>
                      {r.brand_name}
                    </td>
                    <td className="px-3 py-2 text-ink-300">{r.pack_bucket}</td>
                    <td className="px-3 py-2 text-right">
                      <Badge tone="warn">{r.sku_count}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right text-ink-200">
                      {r.supplier_count ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-ink-200">
                      {r.price_spread ? r.price_spread.toFixed(0) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-ink-100">
                      {r.cannibalization_score != null ? r.cannibalization_score.toFixed(2) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="New launch watchlist · 90d"
            hint="Distilleries × brands with concentrated label-approval activity"
          />
          <div className="overflow-x-auto max-h-[440px]">
            <table className="w-full text-xs tabular">
              <thead className="sticky top-0 bg-ink-950/90 backdrop-blur">
                <tr className="text-ink-400 text-2xs uppercase tracking-wider border-b hairline">
                  <th className="text-left px-3 py-2 font-medium">Distillery</th>
                  <th className="text-left px-3 py-2 font-medium">Brand</th>
                  <th className="text-right px-3 py-2 font-medium">Total</th>
                  <th className="text-right px-3 py-2 font-medium">New</th>
                  <th className="text-right px-3 py-2 font-medium">Renewal</th>
                </tr>
              </thead>
              <tbody>
                {pi.new_launch_watchlist.map((r, i) => (
                  <tr key={i} className="border-b hairline hover:bg-ink-800/40">
                    <td className="px-3 py-2 text-ink-200 truncate max-w-[200px]" title={r.distillery}>
                      {shortName(r.distillery, 28)}
                    </td>
                    <td className="px-3 py-2 text-ink-100 truncate max-w-[220px]" title={r.brand_name}>
                      {r.brand_name}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Badge tone="accent">{r.recent_labels}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right text-ink-100">{r.new_labels ?? "—"}</td>
                    <td className="px-3 py-2 text-right text-ink-300">{r.renewals ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="Note on SKU intelligence"
          hint="Interim logic — marked clearly per the honesty contract"
        />
        <PanelBody>
          <p className="text-sm text-ink-300 leading-relaxed max-w-3xl">
            True outlet×SKU demand forecasting, stock-out risk and substitution analytics require an{" "}
            <span className="text-accent-400">outlet × SKU × date sales feed</span>, which is not present in the
            uploaded data. Everything in this screen is computed from the brand / supplier master and label
            approval tables — rule-based, interpretable, and designed to switch to SKU-level forecasts the day
            those feeds arrive without changing the UI surface.
          </p>
        </PanelBody>
      </Panel>
    </>
  );
}
