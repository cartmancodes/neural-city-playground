import { Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "@/components/layout/Shell";
import { useApp } from "@/store/AppContext";

import LandingPage from "@/pages/Landing";
import CitizenHome from "@/pages/citizen/Home";
import CitizenWizard from "@/pages/citizen/Wizard";
import CitizenTrack from "@/pages/citizen/Track";
import CitizenTrackDetail from "@/pages/citizen/TrackDetail";
import OfficerHome from "@/pages/panchayat/Home";
import OfficerApplications from "@/pages/panchayat/Applications";
import OfficerApplicationDetail from "@/pages/panchayat/ApplicationDetail";
import DTCPHome from "@/pages/dtcp/Home";
import DTCPDetail from "@/pages/dtcp/Detail";
import FieldHome from "@/pages/field/Home";
import FieldInspectionDetail from "@/pages/field/InspectionDetail";
import MonitoringHome from "@/pages/monitoring/Home";
import UnauthorizedView from "@/pages/monitoring/Unauthorized";
import RevenueHome from "@/pages/revenue/Home";
import StateCommandCentre from "@/pages/state/Home";
import AlertsHome from "@/pages/alerts/Home";
import AuditHome from "@/pages/audit/Home";
import AssumptionsPage from "@/pages/assumptions/Home";
import GISMapPage from "@/pages/GISMap";
import GuidedDemoPage from "@/pages/demo/Home";
import type { ReactNode } from "react";

function RequireRole({ children }: { children: ReactNode }) {
  const { activeRole } = useApp();
  if (!activeRole) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/demo" element={<GuidedDemoPage />} />
      <Route element={<RequireRole><Shell /></RequireRole>}>
        <Route path="/citizen" element={<CitizenHome />} />
        <Route path="/citizen/apply" element={<CitizenWizard />} />
        <Route path="/citizen/track" element={<CitizenTrack />} />
        <Route path="/citizen/track/:id" element={<CitizenTrackDetail />} />

        <Route path="/officer" element={<OfficerHome />} />
        <Route path="/officer/applications" element={<OfficerApplications />} />
        <Route path="/officer/applications/:id" element={<OfficerApplicationDetail />} />

        <Route path="/dtcp" element={<DTCPHome />} />
        <Route path="/dtcp/applications/:id" element={<DTCPDetail />} />

        <Route path="/field" element={<FieldHome />} />
        <Route path="/field/inspections" element={<FieldHome />} />
        <Route path="/field/inspections/:id" element={<FieldInspectionDetail />} />

        <Route path="/monitoring" element={<MonitoringHome />} />
        <Route path="/monitoring/unauthorized" element={<UnauthorizedView />} />

        <Route path="/revenue" element={<RevenueHome />} />
        <Route path="/state" element={<StateCommandCentre />} />
        <Route path="/alerts" element={<AlertsHome />} />
        <Route path="/audit" element={<AuditHome />} />
        <Route path="/assumptions" element={<AssumptionsPage />} />
        <Route path="/map" element={<GISMapPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
