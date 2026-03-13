import { useEffect, useMemo, useRef, useState } from "react";
import { LogEntry, LogPlatform } from "../types";
import { scanEventsWithYara, YaraRuleMatch, YaraScanStats } from "../lib/yara";
import { EventDetailsModal } from "./EventDetailsModal";
import "./SigmaDetections.css";

interface YaraDetectionsProps {
  events: LogEntry[];
  platform: LogPlatform;
  onOpenRawLogs?: () => void;
}

export default function YaraDetections({
  events,
  platform,
  onOpenRawLogs,
}: YaraDetectionsProps) {
  const [matches, setMatches] = useState<YaraRuleMatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<YaraScanStats | null>(null);
  const [progress, setProgress] = useState({
    processed: 0,
    total: 0,
    matchesFound: 0,
  });
  const lastProgressUpdateRef = useRef(0);
  const [selectedEvent, setSelectedEvent] = useState<LogEntry | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("YARA Matched Event");

  const handleViewEvent = (event: LogEntry, ruleTitle: string) => {
    const eventId = event.eventId || "N/A";
    const source = event.source || event.sourceType || "unknown";
    setModalTitle(`${ruleTitle} - Event ${eventId} - ${source}`);
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  useEffect(() => {
    let cancelled = false;

    if (events.length === 0) {
      setMatches([]);
      setStats(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setMatches([]);
    setStats(null);
    setProgress({ processed: 0, total: 0, matchesFound: 0 });

    scanEventsWithYara(events, platform, (processed, total, matchesFound) => {
      if (cancelled) return;

      const now = performance.now();
      if (now - lastProgressUpdateRef.current < 120 && processed < total) {
        return;
      }
      lastProgressUpdateRef.current = now;

      setProgress({ processed, total, matchesFound });
    })
      .then((result) => {
        if (cancelled) return;
        setMatches(result.matches);
        setStats(result.stats);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error("[YARA] Detection failed:", error);
        if (cancelled) return;
        setMatches([]);
        setStats(null);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [events, platform]);

  const totalMatchedFiles = useMemo(
    () => matches.reduce((sum, match) => sum + match.matchedFiles.length, 0),
    [matches],
  );

  return (
    <div className="sigma-detections">
      <div className="sigma-header">
        <h2>YARA Content Detections</h2>
        <p className="sigma-subtitle">
          Community YARA rules scanned across uploaded {platform} evidence
        </p>
      </div>

      <div className="sigma-summary">
        {isLoading ? (
          <div className="loading-state">
            <div className="sigma-loading-spinner"></div>
            <h3>Scanning With YARA</h3>
            <p>Running bundled YARA rules against the uploaded evidence...</p>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${(progress.processed / Math.max(progress.total, 1)) * 100}%`,
                }}
              />
            </div>
            <div className="progress-text">
              {Math.round(
                (progress.processed / Math.max(progress.total, 1)) * 100,
              )}
              %
              {progress.matchesFound > 0 &&
                ` • ${progress.matchesFound} file hits found`}
            </div>
          </div>
        ) : matches.length === 0 ? (
          <div className="no-threats">
            <span className="success-icon">OK</span>
            <h3>No YARA Hits</h3>
            <p>No bundled YARA rule literals matched the uploaded evidence</p>
          </div>
        ) : (
          <div className="threat-stats">
            <div className="stat-item">
              <span className="stat-number">{matches.length}</span>
              <span className="stat-label">Rules Hit</span>
            </div>
            <div className="stat-item high">
              <span className="stat-number">{totalMatchedFiles}</span>
              <span className="stat-label">File Hits</span>
            </div>
          </div>
        )}
        {!isLoading && stats && (
          <p className="optimization-info">
            Scanned {stats.totalRules.toLocaleString()} YARA rules across{" "}
            {stats.totalFiles.toLocaleString()} file group
            {stats.totalFiles === 1 ? "" : "s"} in{" "}
            {(stats.processingTimeMs / 1000).toFixed(1)}s
          </p>
        )}
        {!isLoading && matches.length > 0 && onOpenRawLogs && (
          <div style={{ marginTop: "0.75rem" }}>
            <button className="action-button" onClick={onOpenRawLogs}>
              Go To Raw Logs View
            </button>
          </div>
        )}
      </div>

      {!isLoading && matches.length > 0 && (
        <div className="sigma-matches">
          {matches.slice(0, 50).map((match) => (
            <div
              key={match.rule.id}
              className="sigma-match high"
              style={{ borderLeftColor: "#f59e0b" }}
            >
              <div className="match-header">
                <div className="match-title">
                  <span className="severity-icon">Y</span>
                  <div>
                    <h3>{match.rule.title}</h3>
                    <div className="rule-meta">
                      {match.rule.sourceName} • {match.rule.path}
                    </div>
                  </div>
                </div>
                <div className="match-count">
                  {match.matchedFiles.length} file hit
                  {match.matchedFiles.length === 1 ? "" : "s"}
                </div>
              </div>

              <div className="match-details" style={{ display: "block" }}>
                {match.rule.description && <p>{match.rule.description}</p>}
                <div className="rule-section">
                  <strong>Matched literals:</strong>{" "}
                  {match.matchedFiles[0]?.matchedLiterals.join(", ")}
                </div>
                <div className="rule-section">
                  <strong>Matched files:</strong>
                  <ul style={{ marginTop: "0.5rem", paddingLeft: "1.2rem" }}>
                    {match.matchedFiles.slice(0, 5).map((file) => (
                      <li key={`${match.rule.id}-${file.sourceFile}`}>
                        {file.sourceFile} • {file.eventCount.toLocaleString()}{" "}
                        events
                        {file.matchedEvents.length > 0 && (
                          <div style={{ marginTop: "0.35rem" }}>
                            {file.matchedEvents.slice(0, 3).map((hit, idx) => (
                              <button
                                key={`${match.rule.id}-${file.sourceFile}-evt-${idx}`}
                                className="action-button"
                                style={{
                                  marginRight: "0.35rem",
                                  marginBottom: "0.3rem",
                                }}
                                onClick={() =>
                                  handleViewEvent(hit.event, match.rule.title)
                                }
                              >
                                View Raw Event (
                                {hit.matchedLiterals.slice(0, 2).join(", ")})
                              </button>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <EventDetailsModal
        event={selectedEvent}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalTitle}
      />
    </div>
  );
}
