import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CheckCircle2, FileQuestion, ListChecks, Layers } from "lucide-react";

export default function AssumptionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Transparency"
        title="Prototype Assumptions"
        subtitle="Where the prototype simulates real systems and what would change in production."
      />

      <Card>
        <CardBody className="text-sm text-ink-700 leading-relaxed">
          This prototype demonstrates the workflow using available rulebook, administrative GeoJSON
          boundaries, APDPMS summary data and simulated application/satellite data. Production deployment
          will require official parcel boundaries, sanctioned plan files, road-width layers, zoning/master
          plan layers, permit-wise fee records and high-resolution satellite/drone imagery.
        </CardBody>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="What is real today" right={<CheckCircle2 className="text-status-pass" size={18} />} />
          <CardBody className="space-y-2 text-sm">
            <Bullet>End-to-end multi-role workflow with role-based routing</Bullet>
            <Bullet>Configurable JSON rule engine with 12+ checks per application</Bullet>
            <Bullet>GIS jurisdiction detection (point-in-polygon) and area computation via Turf.js</Bullet>
            <Bullet>Applicant-drawn polygon → monitoring geofence (the “trust but verify” loop)</Bullet>
            <Bullet>Officer/DTCP/Field/State dashboards with realistic queue logic</Bullet>
            <Bullet>Audit trail and alerts wired into every action</Bullet>
            <Bullet>Recharts-powered revenue and SLA dashboards</Bullet>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="What is mocked" right={<FileQuestion className="text-status-warn" size={18} />} />
          <CardBody className="space-y-2 text-sm">
            <Bullet warn>AP boundary GeoJSON: synthetic rectangles approximating district / mandal / village / ULB shapes</Bullet>
            <Bullet warn>Road widths: a small demo set; not the actual GIS road network</Bullet>
            <Bullet warn>Plan extraction: simulated confidences (no real OCR/ML over PDF/DWG)</Bullet>
            <Bullet warn>Satellite imagery: side-by-side panels are placeholders, not raster tiles</Bullet>
            <Bullet warn>Detected construction polygons: 4 illustrative cases</Bullet>
            <Bullet warn>Authentication: role chooser only — Aadhaar / SSO are stubs</Bullet>
            <Bullet warn>APDPMS feed and fee schedule: indicative; production must use gazetted figures</Bullet>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Production datasets needed" right={<Layers className="text-gov-accent" size={18} />} />
        <CardBody className="grid md:grid-cols-2 gap-3 text-sm">
          <List title="From government systems">
            <li>APDPMS application + fee records (live)</li>
            <li>Land/parcel records (ROR, sub-registrar)</li>
            <li>Master plan / zoning layers</li>
            <li>Sanctioned plan footprints (DXF/SHP per permit)</li>
            <li>Road-width GIS layer (statewide)</li>
          </List>
          <List title="From external integrations">
            <li>High-resolution satellite/drone imagery</li>
            <li>Google Earth Engine or similar monitoring pipeline</li>
            <li>Payment gateway for fee collection</li>
            <li>SMS/WhatsApp notification gateway</li>
            <li>ML plan extraction engine (PDF/DWG)</li>
          </List>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Future integration points" right={<ListChecks className="text-gov-accent" size={18} />} />
        <CardBody className="grid md:grid-cols-2 gap-3 text-sm">
          <List title="Application data">
            <li>APDPMS pull/push (ETL via cron + delta)</li>
            <li>ROR / parcel records (point-in-parcel resolution)</li>
            <li>Permit fee records (per-permit ledger)</li>
          </List>
          <List title="Geospatial">
            <li>Master plan zoning service</li>
            <li>Road-width GIS layer (statewide)</li>
            <li>High-resolution satellite/drone imagery</li>
            <li>Google Earth Engine monitoring pipeline</li>
          </List>
          <List title="Communication">
            <li>SMS/WhatsApp alert dispatch</li>
            <li>Payment gateway</li>
          </List>
          <List title="ML / AI">
            <li>Plan-reading ML/OCR (PDF/DWG)</li>
            <li>Change-detection model on raster imagery</li>
          </List>
        </CardBody>
      </Card>
    </div>
  );
}

function Bullet({ children, warn }: { children: React.ReactNode; warn?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <Badge tone={warn ? "warn" : "pass"} size="sm">{warn ? "Mock" : "Real"}</Badge>
      <span className="text-ink-700">{children}</span>
    </div>
  );
}

function List({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-ink-200 p-3">
      <div className="font-medium text-ink-900 mb-2">{title}</div>
      <ul className="list-disc list-inside text-ink-700 space-y-1">{children}</ul>
    </div>
  );
}
