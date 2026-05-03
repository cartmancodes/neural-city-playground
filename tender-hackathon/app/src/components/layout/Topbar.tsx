import { useNavigate } from "react-router-dom";
import { Globe, ChevronDown, PlayCircle } from "lucide-react";
import { useAppStore, useCurrentCase } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";

export function Topbar() {
  const t = useT();
  const navigate = useNavigate();
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const currentCase = useCurrentCase();
  const setCurrentCaseId = useAppStore((s) => s.setCurrentCaseId);
  const cases = useAppStore((s) => s.cases);
  const currentUser = useAppStore((s) => s.currentUser);
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const users = useAppStore((s) => s.users);

  return (
    <header className="app-topbar sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Active Case</div>
        <div className="relative">
          <select
            value={currentCase?.id ?? ""}
            onChange={(e) => setCurrentCaseId(e.target.value)}
            className="h-8 rounded-md border bg-card px-2 pr-7 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} — {c.projectName.length > 50 ? c.projectName.slice(0, 50) + "…" : c.projectName}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => navigate("/demo")} variant="default">
          <PlayCircle className="h-3.5 w-3.5" />
          {t.buttons.runDemo}
        </Button>

        <div className="relative">
          <button className="flex h-8 items-center gap-1 rounded-md border bg-card px-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring">
            <Globe className="h-3.5 w-3.5" />
            {t.langName[language]}
          </button>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as "en" | "te")}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            <option value="en">English</option>
            <option value="te">తెలుగు</option>
          </select>
        </div>

        <div className="relative">
          <select
            value={currentUser.id}
            onChange={(e) => {
              const u = users.find((x) => x.id === e.target.value);
              if (u) setCurrentUser(u);
            }}
            className="h-8 rounded-md border bg-card px-2 pr-7 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · {u.role}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>
    </header>
  );
}
