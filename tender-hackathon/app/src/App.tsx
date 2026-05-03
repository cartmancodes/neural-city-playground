import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import NewCaseWizard from "@/pages/NewCaseWizard";
import DocumentIntelligence from "@/pages/DocumentIntelligence";
import KnowledgeGraph from "@/pages/KnowledgeGraph";
import Rulebook from "@/pages/Rulebook";
import Drafting from "@/pages/Drafting";
import Validator from "@/pages/Validator";
import Readiness from "@/pages/Readiness";
import BidIntake from "@/pages/BidIntake";
import BidEvaluation from "@/pages/BidEvaluation";
import Compare from "@/pages/Compare";
import Corrigendum from "@/pages/Corrigendum";
import Communication from "@/pages/Communication";
import Approvals from "@/pages/Approvals";
import AuditTrail from "@/pages/AuditTrail";
import Learning from "@/pages/Learning";
import Reports from "@/pages/Reports";
import Security from "@/pages/Security";
import Demo from "@/pages/Demo";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/cases/new" element={<NewCaseWizard />} />
          <Route path="/documents" element={<DocumentIntelligence />} />
          <Route path="/graph" element={<KnowledgeGraph />} />
          <Route path="/rulebook" element={<Rulebook />} />
          <Route path="/drafting" element={<Drafting />} />
          <Route path="/drafting/:caseId" element={<Drafting />} />
          <Route path="/validator" element={<Validator />} />
          <Route path="/readiness" element={<Readiness />} />
          <Route path="/bids/intake" element={<BidIntake />} />
          <Route path="/bids/evaluate" element={<BidEvaluation />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/corrigendum" element={<Corrigendum />} />
          <Route path="/communication" element={<Communication />} />
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/audit" element={<AuditTrail />} />
          <Route path="/learning" element={<Learning />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/security" element={<Security />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
