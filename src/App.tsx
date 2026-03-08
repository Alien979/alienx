import {
  useState,
  useMemo,
  lazy,
  Suspense,
  useEffect,
  useCallback,
} from "react";
import FileDropZone from "./components/FileDropZone";
import AnalysisSelector, { AnalysisMode } from "./components/AnalysisSelector";
import Dashboard from "./components/Dashboard";
const LazySigmaPlatformSelector = lazy(
  () => import("./components/SigmaPlatformSelector"),
);
const LazyDashboards = lazy(() => import("./components/Dashboards"));
const LazyProcessExecutionDashboard = lazy(
  () => import("./components/ProcessExecutionDashboard"),
);
const LazyTimeline = lazy(() => import("./components/Timeline"));
const LazyRawLogsView = lazy(() => import("./components/RawLogsView"));
const LazyLLMAnalysis = lazy(() => import("./components/LLMAnalysis"));
import SessionManager from "./components/SessionManager";
import BookmarkPanel from "./components/BookmarkPanel";
import { EventDetailsModal } from "./components/EventDetailsModal";
import { getBookmarks } from "./lib/eventBookmarks";
import { ParsedData } from "./types";
import type { LogEntry } from "./types";
import { clearVTCache } from "./lib/vtCache";
import { createSigmaEngine, SigmaEngine } from "./lib/sigma";
import { SigmaRuleMatch } from "./lib/sigma/types";
import type { SigmaPlatform } from "./lib/sigma/utils/autoLoadRules";
import SigmaDetections from "./components/SigmaDetections";
import {
  ErrorBoundary,
  FileOperationErrorBoundary,
  AnalysisErrorBoundary,
} from "./components/ErrorBoundary";
import LoadingState from "./components/LoadingState";
import "./components/Dashboard.css";

const LazyIOCExtractor = lazy(() => import("./components/IOCExtractor"));
const LazyEventCorrelation = lazy(
  () => import("./components/EventCorrelation"),
);

type AppView = "upload" | "select" | "sigma-platform" | "analysis";

function App() {
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [filename, setFilename] = useState<string>("");
  const [rulesLoading, setRulesLoading] = useState(false);
  const [ruleLoadProgress, setRuleLoadProgress] = useState<{
    loaded: number;
    total: number;
  } | null>(null);
  const [currentView, setCurrentView] = useState<AppView>("upload");
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode | null>(null);
  const [sigmaMatches, setSigmaMatches] = useState<
    Map<string, SigmaRuleMatch[]>
  >(new Map());
  const [selectedPlatform, setSelectedPlatform] =
    useState<SigmaPlatform | null>(null);
  const [showSessionManager, setShowSessionManager] = useState(false);
  const [showBookmarkPanel, setShowBookmarkPanel] = useState(false);
  const [pivotEvent, setPivotEvent] = useState<LogEntry | null>(null);
  const [bookmarkCount, setBookmarkCount] = useState(
    () => getBookmarks().length,
  );

  // ── Theme toggle (dark / light) ─────────────────────────────
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("alienx-theme") as "dark" | "light") || "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("alienx-theme", theme);
  }, [theme]);

  // Periodically refresh bookmark count (storage events don't fire on same tab)
  useEffect(() => {
    const id = setInterval(() => setBookmarkCount(getBookmarks().length), 2000);
    return () => clearInterval(id);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  // ── Keyboard shortcut help panel ────────────────────────────
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Create SIGMA engine instance (persists across renders)
  const sigmaEngine = useMemo(() => {
    return createSigmaEngine({
      autoCompile: true,
      enableRegex: true,
      strictValidation: false,
    });
  }, []);

  // ── Global keyboard shortcuts ────────────────────────────────
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore when user is typing in an input / textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      // ? → toggle keyboard shortcut help
      if (e.key === "?") {
        e.preventDefault();
        setShowShortcutsHelp((prev) => !prev);
        return;
      }

      // Escape → go back one level (or close modals)
      if (e.key === "Escape") {
        e.preventDefault();
        if (showShortcutsHelp) {
          setShowShortcutsHelp(false);
          return;
        }
        if (currentView === "analysis") handleBackToSelector();
        else if (currentView === "sigma-platform")
          handleBackFromPlatformSelector();
        else if (currentView === "select" && parsedData) handleReset();
        return;
      }

      // Ctrl/Cmd+Shift shortcuts
      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        // L → toggle theme (works from any view)
        if (e.key.toLowerCase() === "l") {
          e.preventDefault();
          toggleTheme();
          return;
        }

        // B → toggle bookmark panel (works when data loaded)
        if (e.key.toLowerCase() === "b" && parsedData) {
          e.preventDefault();
          setShowBookmarkPanel((prev) => !prev);
          return;
        }

        // Quick navigation shortcuts (only from selector view)
        if (currentView === "select" && parsedData) {
          switch (e.key.toLowerCase()) {
            case "s":
              e.preventDefault();
              handleAnalysisSelect("sigma");
              break;
            case "d":
              e.preventDefault();
              handleAnalysisSelect("dashboards");
              break;
            case "t":
              e.preventDefault();
              handleAnalysisSelect("timeline");
              break;
            case "r":
              e.preventDefault();
              handleAnalysisSelect("raw-logs");
              break;
            case "i":
              e.preventDefault();
              handleAnalysisSelect("ioc-extraction");
              break;
            case "e":
              e.preventDefault();
              handleAnalysisSelect("event-correlation");
              break;
          }
        }
      }
    },
    [
      currentView,
      parsedData,
      showShortcutsHelp,
      toggleTheme,
      sigmaMatches,
      selectedPlatform,
    ],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleFileLoaded = (data: ParsedData, name: string) => {
    clearVTCache(); // Clear stale VT results from previous file
    setParsedData(data);
    setFilename(name);
    setCurrentView("select");
  };

  const handleReset = () => {
    setParsedData(null);
    setFilename("");
    setAnalysisMode(null);
    setSigmaMatches(new Map());
    setSelectedPlatform(null);
    // Clear loaded rules from engine
    sigmaEngine.clearRules();
    setCurrentView("upload");
  };

  const handleAnalysisSelect = (mode: AnalysisMode) => {
    if (mode === "sigma") {
      // If we already have cached matches, go directly to analysis
      // Otherwise show platform selector
      if (sigmaMatches.size > 0 && selectedPlatform) {
        setAnalysisMode("sigma");
        setCurrentView("analysis");
      } else {
        setCurrentView("sigma-platform");
      }
    } else {
      setAnalysisMode(mode);
      setCurrentView("analysis");
    }
  };

  const handlePlatformSelect = async (
    platform: SigmaPlatform,
    categories: string[],
  ) => {
    setSelectedPlatform(platform);
    setRulesLoading(true);

    // Clear any previously loaded rules
    sigmaEngine.clearRules();
    setSigmaMatches(new Map());
    setRuleLoadProgress(null);

    // Load rules for selected platform with progress tracking
    const { autoLoadRules } = await import("./lib/sigma/utils/autoLoadRules");
    const loadResult = await autoLoadRules(
      sigmaEngine,
      platform,
      (loaded, total) => setRuleLoadProgress({ loaded, total }),
      categories,
    );

    if (loadResult.errors.length > 0) {
      console.warn(
        `[SIGMA] ${loadResult.loaded} rules loaded, ${loadResult.failed} failed. Errors:`,
        loadResult.errors.slice(0, 20),
      );
    }
    console.log(
      `[SIGMA] Successfully loaded ${loadResult.loaded} rules (${loadResult.failed} failed)`,
    );

    setRulesLoading(false);
    setRuleLoadProgress(null);

    // Switch to analysis view only after rules are loaded
    setAnalysisMode("sigma");
    setCurrentView("analysis");
  };

  const handleBackToSelector = () => {
    setCurrentView("select");
    setAnalysisMode(null);
  };

  const handleBackFromPlatformSelector = () => {
    setCurrentView("select");
  };

  const handleCustomRulesLoaded = async (count: number) => {
    console.log(`Loaded ${count} custom SIGMA rules`);
    // If we have data, we can immediately analyze it with the new rules
    if (parsedData) {
      // Clear previous matches to force re-analysis
      setSigmaMatches(new Map());
      // Switch to analysis view to trigger SigmaDetections to run analysis
      setAnalysisMode("sigma");
      setCurrentView("analysis");
    }
  };

  const handleLoadSession = (
    data: ParsedData,
    name: string,
    platform: string | null,
    matches: Map<string, SigmaRuleMatch[]>,
    _conversation?: { provider: string; model: string; messages: any[] },
  ) => {
    setParsedData(data);
    setFilename(name);
    setSelectedPlatform(platform as SigmaPlatform | null);
    setSigmaMatches(matches);
    setCurrentView("select");
    // Note: conversation history will be handled by LLMAnalysis when it mounts
    // For now, we don't persist it in App state
  };

  // Render based on current view
  let content: JSX.Element;

  if (currentView === "upload" || !parsedData) {
    content = (
      <FileOperationErrorBoundary>
        <FileDropZone
          onFileLoaded={handleFileLoaded}
          rulesLoading={rulesLoading}
          onOpenSessions={() => setShowSessionManager(true)}
        />
      </FileOperationErrorBoundary>
    );
  } else if (currentView === "select") {
    content = (
      <ErrorBoundary>
        <AnalysisSelector
          data={parsedData}
          filename={filename}
          onSelect={handleAnalysisSelect}
          onReset={handleReset}
          onOpenSessions={() => setShowSessionManager(true)}
          sigmaMatches={sigmaMatches}
          platform={selectedPlatform}
        />
      </ErrorBoundary>
    );
  } else if (currentView === "sigma-platform") {
    content = (
      <ErrorBoundary>
        <Suspense
          fallback={<LoadingState message="Loading platform selector..." />}
        >
          <LazySigmaPlatformSelector
            onSelect={handlePlatformSelect}
            onBack={handleBackFromPlatformSelector}
            sigmaEngine={sigmaEngine}
            onCustomRulesLoaded={handleCustomRulesLoaded}
          />
        </Suspense>
      </ErrorBoundary>
    );
  } else if (analysisMode === "sigma") {
    content = (
      <AnalysisErrorBoundary>
        <SigmaAnalysisView
          data={parsedData}
          filename={filename}
          sigmaEngine={sigmaEngine}
          platform={selectedPlatform}
          rulesLoading={rulesLoading}
          ruleLoadProgress={ruleLoadProgress}
          onBack={handleBackToSelector}
          cachedMatches={sigmaMatches}
          onMatchesUpdate={setSigmaMatches}
        />
      </AnalysisErrorBoundary>
    );
  } else if (analysisMode === "dashboards") {
    content = (
      <AnalysisErrorBoundary>
        <Suspense
          fallback={<LoadingState message="Loading dashboards..." fullPage />}
        >
          <LazyDashboards data={parsedData} onBack={handleBackToSelector} />
        </Suspense>
      </AnalysisErrorBoundary>
    );
  } else if (analysisMode === "process-analysis") {
    content = (
      <AnalysisErrorBoundary>
        <Suspense
          fallback={
            <LoadingState message="Loading process analysis..." fullPage />
          }
        >
          <LazyProcessExecutionDashboard
            entries={parsedData.entries}
            onBack={handleBackToSelector}
            onPivotToEvent={(entry) => setPivotEvent(entry)}
          />
        </Suspense>
      </AnalysisErrorBoundary>
    );
  } else if (analysisMode === "timeline") {
    content = (
      <AnalysisErrorBoundary>
        <Suspense
          fallback={<LoadingState message="Loading timeline..." fullPage />}
        >
          <TimelineAnalysisView
            data={parsedData}
            filename={filename}
            sigmaEngine={sigmaEngine}
            sigmaMatches={sigmaMatches}
            setSigmaMatches={setSigmaMatches}
            onBack={handleBackToSelector}
          />
        </Suspense>
      </AnalysisErrorBoundary>
    );
  } else if (analysisMode === "raw-logs") {
    content = (
      <ErrorBoundary>
        <Suspense
          fallback={<LoadingState message="Loading raw logs..." fullPage />}
        >
          <LazyRawLogsView
            data={parsedData}
            filename={filename}
            onBack={handleBackToSelector}
            sigmaMatches={sigmaMatches}
          />
        </Suspense>
      </ErrorBoundary>
    );
  } else if (analysisMode === "ai-analysis") {
    content = (
      <AnalysisErrorBoundary>
        <Suspense
          fallback={<LoadingState message="Loading AI analysis..." fullPage />}
        >
          <LazyLLMAnalysis
            data={parsedData}
            sigmaMatches={sigmaMatches}
            onBack={handleBackToSelector}
          />
        </Suspense>
      </AnalysisErrorBoundary>
    );
  } else if (analysisMode === "ioc-extraction") {
    content = (
      <AnalysisErrorBoundary>
        <Suspense
          fallback={
            <LoadingState message="Loading IOC extractor..." fullPage />
          }
        >
          <LazyIOCExtractor
            entries={parsedData.entries}
            onBack={handleBackToSelector}
            sigmaMatches={sigmaMatches}
          />
        </Suspense>
      </AnalysisErrorBoundary>
    );
  } else if (analysisMode === "event-correlation") {
    content = (
      <AnalysisErrorBoundary>
        <Suspense
          fallback={
            <LoadingState message="Loading correlation view..." fullPage />
          }
        >
          <LazyEventCorrelation
            entries={parsedData.entries}
            sigmaMatches={sigmaMatches}
            onBack={handleBackToSelector}
            data={parsedData}
            filename={filename}
            platform={selectedPlatform}
            onPivotToEvent={(entry) => setPivotEvent(entry)}
          />
        </Suspense>
      </AnalysisErrorBoundary>
    );
  } else {
    content = (
      <ErrorBoundary>
        <AnalysisSelector
          data={parsedData}
          filename={filename}
          onSelect={handleAnalysisSelect}
          onReset={handleReset}
        />
      </ErrorBoundary>
    );
  }

  const sessionContext = parsedData
    ? {
        currentData: parsedData,
        currentFilename: filename,
        currentPlatform: selectedPlatform,
        currentMatches: sigmaMatches,
        currentConversation: undefined, // Conversation managed by LLMAnalysis
      }
    : {
        currentData: null,
        currentFilename: "",
        currentPlatform: null as SigmaPlatform | null,
        currentMatches: new Map<string, SigmaRuleMatch[]>(),
        currentConversation: undefined,
      };

  return (
    <div className="app">
      <div className="app-main">{content}</div>

      {/* Theme toggle button */}
      <button
        className="theme-toggle-btn"
        onClick={toggleTheme}
        title={`Switch to ${theme === "dark" ? "light" : "dark"} mode (Ctrl+Shift+L)`}
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </button>

      {/* Bookmark panel button — visible when data is loaded */}
      {parsedData && (
        <button
          className="theme-toggle-btn"
          onClick={() => setShowBookmarkPanel(true)}
          title="View bookmarked events (Ctrl+Shift+B)"
          style={{ left: 72, position: "fixed" }}
        >
          🔖
          {bookmarkCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                background: "#ff4444",
                color: "#fff",
                borderRadius: "50%",
                minWidth: 18,
                height: 18,
                fontSize: "0.65rem",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 4px",
                lineHeight: 1,
              }}
            >
              {bookmarkCount > 99 ? "99+" : bookmarkCount}
            </span>
          )}
        </button>
      )}

      {/* Keyboard shortcuts help button */}
      <button
        className="theme-toggle-btn"
        onClick={() => setShowShortcutsHelp(true)}
        title="Keyboard shortcuts (?)"
        style={{ left: parsedData ? 120 : 72 }}
      >
        ?
      </button>

      {showSessionManager && (
        <SessionManager
          {...sessionContext}
          onLoadSession={handleLoadSession}
          onClose={() => setShowSessionManager(false)}
        />
      )}

      {showBookmarkPanel && parsedData && (
        <BookmarkPanel
          entries={parsedData.entries}
          onClose={() => setShowBookmarkPanel(false)}
          onPivotToEvent={(entry) => {
            setShowBookmarkPanel(false);
            setPivotEvent(entry);
          }}
        />
      )}

      {pivotEvent && (
        <EventDetailsModal
          event={pivotEvent}
          isOpen={true}
          onClose={() => setPivotEvent(null)}
          title="Bookmarked Event"
        />
      )}

      {/* Keyboard shortcut help modal */}
      {showShortcutsHelp && (
        <div
          className="feedback-modal-backdrop"
          onClick={() => setShowShortcutsHelp(false)}
        >
          <div
            className="feedback-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 380 }}
          >
            <h3 style={{ marginBottom: "0.75rem" }}>⌨️ Keyboard Shortcuts</h3>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.85rem",
              }}
            >
              <tbody>
                {[
                  ["?", "Toggle this help panel"],
                  ["Escape", "Go back / close modals"],
                  ["Ctrl+Shift+L", "Toggle dark / light theme"],
                  ["Ctrl+Shift+B", "Toggle bookmark panel"],
                  ["Ctrl+Shift+S", "Open SIGMA detections"],
                  ["Ctrl+Shift+D", "Open Dashboards"],
                  ["Ctrl+Shift+T", "Open Timeline"],
                  ["Ctrl+Shift+R", "Open Raw Logs"],
                  ["Ctrl+Shift+I", "Open IOC Extraction"],
                  ["Ctrl+Shift+E", "Open Event Correlation"],
                ].map(([key, desc]) => (
                  <tr key={key}>
                    <td
                      style={{
                        padding: "4px 8px 4px 0",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <kbd
                        style={{
                          background: "rgba(255,255,255,0.08)",
                          border: "1px solid rgba(255,255,255,0.2)",
                          borderRadius: 4,
                          padding: "2px 6px",
                          fontFamily: "monospace",
                          fontSize: "0.8rem",
                        }}
                      >
                        {key}
                      </kbd>
                    </td>
                    <td style={{ padding: "4px 0", color: "#ccc" }}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p
              style={{
                marginTop: "0.75rem",
                fontSize: "0.75rem",
                color: "#888",
              }}
            >
              Navigation shortcuts work from the analysis selector view.
            </p>
            <button
              className="feedback-close"
              onClick={() => setShowShortcutsHelp(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// SIGMA Analysis View Component
interface SigmaAnalysisViewProps {
  data: ParsedData;
  filename: string;
  sigmaEngine: SigmaEngine;
  platform: SigmaPlatform | null;
  rulesLoading: boolean;
  ruleLoadProgress: { loaded: number; total: number } | null;
  onBack: () => void;
  onMatchesUpdate: (matches: Map<string, SigmaRuleMatch[]>) => void;
  cachedMatches: Map<string, SigmaRuleMatch[]>;
}

function SigmaAnalysisView({
  data,
  filename,
  sigmaEngine,
  platform: _platform,
  rulesLoading: _rulesLoading,
  ruleLoadProgress: _ruleLoadProgress,
  onBack,
  onMatchesUpdate,
  cachedMatches,
}: SigmaAnalysisViewProps) {
  // Skip loading screen - rules load in background
  return (
    <Dashboard
      data={data}
      filename={filename}
      onBack={onBack}
      sigmaEngine={sigmaEngine}
      onMatchesUpdate={onMatchesUpdate}
      cachedMatches={cachedMatches}
    />
  );
}

// Timeline Analysis View Component
interface TimelineAnalysisViewProps {
  data: ParsedData;
  filename: string;
  sigmaEngine: SigmaEngine;
  sigmaMatches: Map<string, SigmaRuleMatch[]>;
  setSigmaMatches: (matches: Map<string, SigmaRuleMatch[]>) => void;
  onBack: () => void;
}

function TimelineAnalysisView({
  data,
  sigmaEngine,
  sigmaMatches,
  setSigmaMatches,
  onBack,
}: TimelineAnalysisViewProps) {
  const [hasProcessed, setHasProcessed] = useState(sigmaMatches.size > 0);

  // If no SIGMA matches yet, show a processing state or run detection
  if (sigmaMatches.size === 0 && !hasProcessed) {
    return (
      <div className="dashboard">
        <div className="dashboard-header">
          <div>
            <h1>Threat Timeline</h1>
            <p className="tagline">Processing SIGMA detections...</p>
          </div>
          <button className="timeline-button" onClick={onBack}>
            ← Back to Selection
          </button>
        </div>
        <section className="sigma-section">
          <SigmaDetections
            events={data.entries}
            sigmaEngine={sigmaEngine}
            onMatchesUpdate={(matches) => {
              setSigmaMatches(matches);
              setHasProcessed(true);
            }}
            cachedMatches={sigmaMatches}
            sourceFiles={data.sourceFiles}
          />
        </section>
      </div>
    );
  }

  return <LazyTimeline matches={sigmaMatches} onBack={onBack} />;
}

export default App;
