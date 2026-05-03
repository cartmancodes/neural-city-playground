import { useAppStore } from "@/store/useAppStore";

interface DictShape {
  appName: string;
  tagline: string;
  nav: Record<string, string>;
  severity: Record<string, string>;
  buttons: Record<string, string>;
  langName: { en: string; te: string };
}

const en: DictShape = {
  appName: "Procure Intelligence AP",
  tagline:
    "AI-powered procurement control layer for Government of Andhra Pradesh.",
  nav: {
    dashboard: "Dashboard",
    newCase: "New Procurement Case",
    documents: "Document Intelligence",
    graph: "Knowledge Graph",
    rulebook: "Rulebook Manager",
    drafting: "Tender Drafting",
    validator: "Pre-RFP Validator",
    readiness: "Tender Readiness Gate",
    bidIntake: "Bid Submission Intake",
    bidEval: "Bid Evaluation",
    corrigendum: "Corrigendum Analyzer",
    compare: "Document Comparison",
    communication: "Communication",
    approvals: "Officer Approval Queue",
    audit: "Audit Trail",
    learning: "Learning Dashboard",
    security: "Security & Deployment",
    demo: "Demo Pipeline",
    reports: "Reports",
  },
  severity: {
    Critical: "Critical",
    Moderate: "Moderate",
    Low: "Low",
    Passed: "Passed",
    Pending: "Pending",
  },
  buttons: {
    runDemo: "Run Hackathon Demo",
    generate: "Generate",
    save: "Save as Draft",
    runValidation: "Run Pre-RFP Validation",
    autoFix: "Auto-fix Safe Items",
    sendApproval: "Send for Approval",
    export: "Export",
  },
  langName: { en: "English", te: "తెలుగు" },
};

const te: DictShape = {
  ...en,
  appName: "ప్రొక్యూర్ ఇంటెలిజెన్స్ ఏపీ",
  tagline:
    "ఆంధ్ర ప్రదేశ్ ప్రభుత్వానికి AI-ఆధారిత ప్రొక్యూర్‌మెంట్ నియంత్రణ పొర.",
  nav: {
    dashboard: "డాష్‌బోర్డ్",
    newCase: "కొత్త ప్రొక్యూర్‌మెంట్ కేస్",
    documents: "డాక్యుమెంట్ ఇంటెలిజెన్స్",
    graph: "నాలెడ్జ్ గ్రాఫ్",
    rulebook: "రూల్‌బుక్ మేనేజర్",
    drafting: "టెండర్ డ్రాఫ్టింగ్",
    validator: "ప్రీ-ఆర్ఎఫ్‌పీ వాలిడేటర్",
    readiness: "టెండర్ సిద్ధత ద్వారం",
    bidIntake: "బిడ్ ఇన్‌టేక్",
    bidEval: "బిడ్ మూల్యాంకనం",
    corrigendum: "కరిజెండం విశ్లేషణ",
    compare: "డాక్యుమెంట్ పోలిక",
    communication: "కమ్యూనికేషన్",
    approvals: "ఆఫీసర్ ఆమోదాల వరుస",
    audit: "ఆడిట్ ట్రయిల్",
    learning: "లెర్నింగ్ డాష్‌బోర్డ్",
    security: "భద్రత & విస్తరణ",
    demo: "డెమో పైప్లైన్",
    reports: "నివేదికలు",
  },
  severity: {
    Critical: "క్రిటికల్",
    Moderate: "మోడరేట్",
    Low: "తక్కువ",
    Passed: "పాస్",
    Pending: "పెండింగ్",
  },
  buttons: {
    runDemo: "హ్యాకథాన్ డెమో రన్ చేయండి",
    generate: "జనరేట్",
    save: "డ్రాఫ్ట్‌గా సేవ్ చేయండి",
    runValidation: "ప్రీ-ఆర్ఎఫ్‌పీ వాలిడేషన్ రన్ చేయండి",
    autoFix: "సురక్షితమైన అంశాలను ఆటో-ఫిక్స్ చేయండి",
    sendApproval: "ఆమోదానికి పంపండి",
    export: "ఎగుమతి చేయండి",
  },
  langName: { en: "English", te: "తెలుగు" },
};

const dicts = { en, te };

export type Dict = DictShape;

export function useT(): Dict {
  const lang = useAppStore((s) => s.language);
  return dicts[lang];
}
