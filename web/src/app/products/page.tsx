import {
  Badge,
  Kpi,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
} from "@/components/ui/primitives";
import { getProductIntel } from "@/lib/data";
import { formatNumber } from "@/lib/format";

export default async function ProductsPage() {
  const pi = await getProductIntel();

  // Build price-band × pack-bucket heatmap
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

  return (
    <>
      <PageHeader
        eyebrow="Product & Assortment"
        title="Catalog geometry — without true SKU sales"
        description={pi.tag}
        action={<Badge tone="info">{pi.sku_total} SKUs · {pi.brand_total} brands</Badge>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Kpi label="SKU catalog" value={formatNumber(pi.sku_total)} hint="active product codes" tone="neutral" />
        <Kpi label="Active brands" value={formatNumber(pi.brand_total)} hint="distinct brand codes" tone="neutral" />
        <Kpi
          label="Rationalization candidates"
          value={formatNumber(pi.rationalization_candidates.length)}
          hint="≥3 SKUs same brand × pack"
          tone="warn"
        />
        <Kpi
          label="Recent label approvals"
          value={formatNumber(pi.new_launch_watchlist.reduce((s, x) => s + x.recent_labels, 0))}
          hint="last 90 days"
          tone="accent"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
        <Panel>
          <PanelHeader
            title="Rationalization candidates"
            hint="Same brand × pack with ≥3 SKUs · consider consolidation"
          />
          <div className="overflow-x-auto">
            <table className="w-full text-xs tabular">
              <thead>
                <tr className="text-ink-400 text-2xs uppercase tracking-wider border-b hairline">
                  <th className="text-left px-3 py-2 font-medium">Brand</th>
                  <th className="text-left px-3 py-2 font-medium">Pack</th>
                  <th className="text-right px-3 py-2 font-medium">SKUs</th>
                  <th className="text-right px-3 py-2 font-medium">Price spread ₹</th>
                </tr>
              </thead>
              <tbody>
                {pi.rationalization_candidates.slice(0, 18).map((r, i) => (
                  <tr key={i} className="border-b hairline hover:bg-ink-800/40">
                    <td className="px-3 py-2 text-ink-100 truncate max-w-[280px]">{r.brand_name}</td>
                    <td className="px-3 py-2 text-ink-300">{r.pack_bucket}</td>
                    <td className="px-3 py-2 text-right">
                      <Badge tone="warn">{r.sku_count}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right text-ink-200">
                      {r.price_spread ? r.price_spread.toFixed(0) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="New launch watchlist"
            hint="Distilleries with concentrated label approval activity · last 90d"
          />
          <div className="overflow-x-auto max-h-[420px]">
            <table className="w-full text-xs tabular">
              <thead>
                <tr className="text-ink-400 text-2xs uppercase tracking-wider border-b hairline">
                  <th className="text-left px-3 py-2 font-medium">Distillery</th>
                  <th className="text-left px-3 py-2 font-medium">Brand</th>
                  <th className="text-right px-3 py-2 font-medium">Recent labels</th>
                </tr>
              </thead>
              <tbody>
                {pi.new_launch_watchlist.map((r, i) => (
                  <tr key={i} className="border-b hairline hover:bg-ink-800/40">
                    <td className="px-3 py-2 text-ink-200 truncate max-w-[200px]">{r.distillery}</td>
                    <td className="px-3 py-2 text-ink-100 truncate max-w-[240px]">{r.brand_name}</td>
                    <td className="px-3 py-2 text-right">
                      <Badge tone="accent">{r.recent_labels}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Panel className="mb-6">
        <PanelHeader title="Brand proliferation" hint="Top 15 brands by SKU spread · assortment-bloat candidates" />
        <div className="overflow-x-auto">
          <table className="w-full text-xs tabular">
            <thead>
              <tr className="text-ink-400 text-2xs uppercase tracking-wider border-b hairline">
                <th className="text-left px-3 py-2 font-medium">Brand</th>
                <th className="text-right px-3 py-2 font-medium">SKUs</th>
                <th className="text-right px-3 py-2 font-medium">Suppliers</th>
                <th className="text-right px-3 py-2 font-medium">Distilleries</th>
                <th className="text-left px-3 py-2 font-medium">Proliferation</th>
              </tr>
            </thead>
            <tbody>
              {pi.brand_proliferation_top.slice(0, 15).map((b) => (
                <tr key={b.brand_name} className="border-b hairline hover:bg-ink-800/40">
                  <td className="px-3 py-2 text-ink-100 truncate max-w-[280px]">{b.brand_name}</td>
                  <td className="px-3 py-2 text-right text-ink-100">{b.sku_count}</td>
                  <td className="px-3 py-2 text-right text-ink-200">{b.supplier_count}</td>
                  <td className="px-3 py-2 text-right text-ink-200">{b.distillery_count}</td>
                  <td className="px-3 py-2">
                    <div className="h-1.5 w-32 rounded-full bg-ink-800 overflow-hidden">
                      <div
                        className="h-full bg-accent-500"
                        style={{ width: `${Math.min(100, b.proliferation_score * 100)}%` }}
                      />
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
          title="Note on SKU intelligence"
          hint="Interim logic — marked clearly per the honesty contract"
        />
        <PanelBody>
          <p className="text-sm text-ink-300 leading-relaxed max-w-3xl">
            True outlet×SKU demand forecasting, stock-out risk and substitution analytics require an{" "}
            <span className="text-accent-400">outlet × SKU × date sales feed</span>, which is not present in the
            uploaded data. Everything on this page is computed from the brand / product master and label approval
            tables — rule-based, interpretable, and designed to switch to SKU-level forecasts the day those feeds
            arrive without changing the UI surface.
          </p>
        </PanelBody>
      </Panel>
    </>
  );
}
