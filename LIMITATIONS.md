# ALIENX Application Limitations

This document provides a comprehensive overview of the known limitations, constraints, and trade-offs in the ALIENX Windows Event Log analyzer application.

## Table of Contents

- [Performance Limitations](#performance-limitations)
- [Browser and Platform Constraints](#browser-and-platform-constraints)
- [Feature Limitations](#feature-limitations)
- [Scalability Issues](#scalability-issues)
- [Security and Privacy Constraints](#security-and-privacy-constraints)
- [UI/UX Limitations](#uiux-limitations)
- [Detection and Analysis Limitations](#detection-and-analysis-limitations)
- [LLM Integration Limitations](#llm-integration-limitations)
- [Additional Constraints](#additional-constraints)
- [Design Philosophy](#design-philosophy)

---

## Performance Limitations

### File Size Constraints

- **Maximum file size**: 1GB per EVTX file
  - Previously limited to 500MB; increased due to WASM parsing optimizations
  - Files exceeding this limit will be rejected with an error message
  - Recommendation: Filter events before exporting or split large log files

### Event Count Limits

- **Correlation Engine**: Limited to processing 50,000 events (`MAX_EVENTS_TO_CORRELATE`)
  - Events beyond this limit are not correlated
  - Performance warning issued for files with >25,000 events
- **IOC Extraction**: Limited to first 50,000 log entries
  - Additional entries are not processed for IOC extraction
- **General Performance**: Application performance degrades noticeably with >25k events

### Session Storage

- **Maximum session size**: 4MB per saved session
  - Sessions exceeding this size cannot be saved
  - Limited by browser LocalStorage constraints (typically 5-10MB total per domain)
- **Maximum sessions**: 10 saved sessions maximum (`MAX_SESSIONS`)
  - Oldest sessions automatically removed when limit is exceeded

---

## Browser and Platform Constraints

### Client-Side Processing

- **100% browser-based**: All log processing occurs in the browser
  - No server-side processing or validation
  - All data remains on the user's machine (except LLM features)
  - Cannot leverage server-side computing resources

### WebAssembly Requirements

- **WASM support required**: Application depends on WebAssembly for binary EVTX parsing
  - Older browsers without WASM support cannot parse binary EVTX files
  - Fallback to XML parsing available, but limited to exported XML logs
  - Potential errors: `WASM_PARSING_ERROR`, `WASM_INITIALIZATION_ERROR`

### Browser Storage Limits

- **LocalStorage**: Typically 5-10MB per domain (varies by browser)
  - Application assumes 5MB limit for session storage
  - Tracks storage usage and warns when approaching limit
  - Clearing browser data deletes all saved sessions
- **SessionStorage**: Limited lifetime (cleared when browser/tab closes)
  - LLM conversation history stored in sessionStorage
  - Lost when browser is closed or tab is refreshed

### Memory Constraints

- **Browser memory**: Large files can cause out-of-memory errors
  - Chunked processing helps but doesn't eliminate the risk
  - Users with limited RAM or many open browser tabs may experience issues
  - Error message: "Your browser ran out of memory. Close other tabs or use a smaller file."

### Network Requirements

- **Offline support**: Application works offline except for:
  - LLM analysis features (requires external API access)
  - VirusTotal IOC lookups (requires API access)
  - Initial page load (requires downloading application assets)
  - SIGMA rule submodule updates (requires git connectivity)

---

## Feature Limitations

### File Format Support

- **Windows Event Logs only**: Supports only EVTX (binary) and XML exports
  - No support for other log formats (Syslog, CEF, JSON logs, etc.)
  - No support for other Windows log formats (ETL, EVT)
  - No support for Linux/macOS system logs

### Export Formats

- **Limited export options**: Only HTML, Markdown, and JSON formats
  - No CSV export for spreadsheet analysis
  - No Excel/XLSX export
  - No database export (SQL, NoSQL)
  - No SIEM integration (Splunk, Elastic, etc.)

### XML Parsing Limitations

- **Large XML files**: May fail to parse very large XML exports
  - DOMParser has browser-specific size limits
  - Error message: "XML file is too large for browser to parse"
  - Chunked reading (10MB chunks) helps but doesn't solve all cases
- **Malformed XML**: Limited error recovery for incomplete/truncated files
  - Attempts basic recovery for premature end-of-data
  - Severely corrupted files will fail to parse

### SIGMA Rule Support

- **Partial modifier support**: Some SIGMA rule modifiers may not be fully supported
  - Complex transformations may not work as expected
  - Pure negation rules cannot match (by design, to prevent false positives)
- **Custom rule validation**: No validation of uploaded custom SIGMA rules
  - Malformed rules may fail silently or cause unexpected behavior
  - No syntax checking or rule testing before loading

### No Server-Side Features

- **No collaboration**: Cannot share sessions or analysis with other users
- **No cloud storage**: Cannot save sessions to cloud for access from multiple devices
- **No scheduled analysis**: Cannot run automated/scheduled log analysis
- **No centralized management**: Cannot manage multiple investigations centrally

---

## Scalability Issues

### Memory-Intensive Operations

- **Direct WASM parsing**: While optimized (direct WASM→LogEntry conversion), still constrained by browser memory
  - Pre-allocation hints help but don't eliminate memory pressure
  - Large files (>500MB) may require multiple attempts or lower memory usage from other tabs
- **BigInt timestamp handling**: Special sanitization required for Windows FILETIME timestamps
  - Can cause chunk parsing failures if not properly handled
  - Some chunks may be skipped due to BigInt serialization errors

### Performance Degradation Patterns

- **Correlation analysis**: Noticeably slower with >50,000 events
  - Algorithm complexity scales with event count
  - Maximum chain depth limited to 100 to prevent infinite recursion
- **IOC extraction**: Limited to first 50,000 entries
  - Additional entries ignored to maintain responsiveness
- **Rendering limits**: Display batching helps but large result sets still impact UI
  - Intersection Observer used for virtual scrolling
  - Legacy scroll handler as fallback for older browsers

### Display Limitations

- **Raw logs**: Shows maximum 100 log entries at a time
- **Timeline**: Maximum 100 events per time bucket
- **IOC pivot**: Maximum 50 related events shown
- **Detection matches**: Maximum 10 matches shown per SIGMA rule in UI
  - All matches still detected and exportable; only display is limited

---

## Security and Privacy Constraints

### API Key Storage

- **Client-side storage**: API keys stored in browser LocalStorage
  - Only base64 encoding (obfuscation), not true encryption
  - Vulnerable to XSS attacks or malicious browser extensions
  - Source code warning: "For production, consider more secure options or backend proxy"
  - Keys persist until manually deleted or browser data cleared

### No Server-Side Validation

- **API keys**: Cannot validate API keys server-side before use
  - Invalid keys only detected when making actual API calls
  - Potential for wasted API quota on invalid requests

### Data Exposure via LLM APIs

- **External API calls**: LLM analysis features send data to external services
  - Anthropic Claude, OpenAI GPT, Google Gemini APIs
  - Local Ollama option available for privacy-focused users
  - Data summaries (not full logs) sent to LLM providers
  - Users must trust third-party LLM providers

### VirusTotal Integration

- **Rate limiting**: Limited to 4 requests per minute (free tier)
  - 15.5-second delay enforced between requests
  - Can be slow for large IOC result sets
  - Requires sharing indicators with VirusTotal

### No Audit Trail

- **Session history**: No persistent audit log of actions taken
  - Cannot track who analyzed what logs when (single-user tool)
  - Session notes are the only persistent context

---

## UI/UX Limitations

### Display Truncation

To maintain UI performance and readability, various fields are truncated:

- **Registry paths**: 100 characters maximum
- **File paths**: 60 characters maximum
- **Messages**: 200 characters maximum
- **Field values in exports**: 100 characters maximum
- Truncated values show "..." but full values lost in UI (available in raw data)

### Batch Display Limits

To keep the interface responsive:

- **SIGMA detections**: Maximum 10 matches shown per rule initially
  - Load more available via scrolling
- **IOC extraction**: Maximum 100 IOCs shown per category initially
  - Full list available in export
- **Timeline buckets**: Maximum 100 events per time bucket
- **Process dashboard**: 15-50 items per category depending on view

### Correlation Display

- **Events per chain**: Maximum 10 events shown per correlation chain (hardcoded)
- **Chains in export**: Maximum 20 correlation chains exported
- **Process tree depth**: Maximum 100 levels to prevent infinite recursion

### Export Truncation

- **Sample events**: Maximum 3-5 sample events per detection rule in reports
- **Tags**: Maximum 5 tags shown per rule in reports
- **Statistics**: Top 10 items per category in dashboard exports

---

## Detection and Analysis Limitations

### SIGMA Rule Coverage

- **Curated rule set**: Limited to rules in the bundled SIGMA submodule
  - Coverage depends on rule quality and maintenance
  - Some attack techniques may not have rules
  - Rules may become outdated as attack techniques evolve
- **Custom rules**: Users can upload custom rules, but no validation or testing provided

### False Positive Management

- **IP extraction**: Filters known false positives but may miss some edge cases
  - Filters version strings (e.g., "1.2.3.4")
  - Filters "0.0.0.0" patterns
  - May still extract non-IP addresses that match IP pattern
- **Base64 detection**: Minimum 20 characters to reduce false positives
  - Short encoded strings may be missed
  - Non-malicious base64 may still be flagged
- **Unix path exclusion**: Reduces false positives but may exclude legitimate Unix paths in cross-platform environments

### Event Provider Matching

- **Provider validation**: Prevents some false positives by validating EventID/Provider pairs
  - Example: RPC Event ID 1 won't match Sysmon rules
  - However, may miss detections if event structure varies unexpectedly

### Field Indexing

- **Pre-indexed fields**: Only high-frequency fields pre-indexed for performance
  - SIGMA rules using rare/custom fields may be slower to match
  - Some field combinations may not be optimally indexed
- **Regex cache**: Limited to 1000 compiled regex patterns (`MAX_REGEX_CACHE_SIZE`)
  - Older patterns evicted when cache is full
  - May cause slight performance degradation with very large rule sets

### Detection Blind Spots

- **Pure negation rules**: Cannot match events with only negation conditions
  - By design to prevent massive false positives
  - May miss some legitimate detection scenarios
- **Multi-event correlation**: Limited to events already flagged by SIGMA rules
  - Cannot correlate events that didn't trigger any SIGMA rule
  - Context events included, but initial detection required

---

## LLM Integration Limitations

### Provider Rate Limits

- **All providers**: Subject to their respective rate limiting policies
  - OpenAI: Varies by account tier
  - Anthropic: Varies by account tier
  - Google: Varies by account tier
  - Ollama: Local server capacity
- **429 errors**: Handled with user-friendly messages, but analysis may fail
- **New accounts**: May have stricter limits until credits/history established

### Model Support

- **Fixed model list**: Limited to pre-configured models per provider
  - OpenAI: GPT-4o, GPT-4o-mini, o1-mini, o1-preview
  - Anthropic: Claude 3.5 Sonnet, Claude Opus, Claude Sonnet 4.5
  - Google: Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini 2.0 Flash
  - Ollama: User's installed models
- **No model auto-detection**: Doesn't automatically detect new models
- **No fine-tuned models**: Cannot use organization-specific fine-tuned models

### Data Truncation

To stay within token limits and maintain performance:

- **Sample events**: Limited to 3 per detection rule
- **Tags**: Limited to 5 per rule
- **Statistics**: Top 10 items per category
- **IOCs**: Summary counts only, not full lists
- May lose important context due to truncation

### Feature Gaps

- **No file attachments**: OpenAI provider doesn't support file attachments
  - Analysis based on text summaries only
- **No streaming**: Some providers may buffer entire response
  - Can appear unresponsive for large analyses
- **No conversation branching**: Linear conversation flow only
- **No conversation export**: Cannot export/share LLM conversations

### Ollama-Specific Limitations

- **Local server required**: Must run Ollama server locally
- **CORS configuration**: May require CORS header configuration
- **Network access**: Must be accessible from browser
- **Model availability**: Limited to models user has downloaded/installed

---

## Additional Constraints

### Multi-File Analysis

- **No deduplication**: Events from multiple files merged as-is
  - Duplicate events across files are not removed
  - Can artificially inflate event counts and detection frequencies
- **File filtering**: Can filter by source file, but no automatic correlation of related files

### Sample Data

- **Generated samples**: Demo samples are artificially generated
  - Not based on real-world attack data
  - May not reflect actual log patterns
  - Useful for feature demonstration, not security validation

### Browser Compatibility

- **Modern browsers required**: Designed for current versions of Chrome, Firefox, Edge, Safari
  - Older browsers may have issues with WASM, lazy loading, or modern JavaScript features
  - No explicit browser version requirements documented
  - No testing on mobile browsers

### Regex Performance

- **Cache size**: Limited to 1000 compiled regex patterns
  - Large SIGMA rule sets may cause cache thrashing
  - Pattern compilation overhead on cache miss
- **Complex patterns**: Some SIGMA rules use complex regex that may be slow
  - No timeout protection for runaway regex patterns

### Chunk Parsing Errors

- **BigInt timestamps**: Some EVTX chunks may be skipped due to JavaScript BigInt limitations
  - Warning logged: "Skipping chunk X due to BigInt timestamp issue"
  - May result in incomplete log analysis if multiple chunks fail
- **Corrupted chunks**: Individual chunk parsing errors cause chunk to be skipped
  - Logs warning but continues with remaining chunks
  - May silently lose data if many chunks are corrupted

---

## Design Philosophy

### Privacy-First Trade-offs

ALIENX prioritizes **privacy and data sovereignty** over scale and enterprise features. This results in:

✅ **Benefits**:

- Zero telemetry or tracking
- Complete data isolation (no server uploads)
- No external dependencies (except optional LLM features)
- Works offline (except LLM/VT features)
- No subscription or account required

❌ **Trade-offs**:

- Limited to browser memory and processing power
- Cannot leverage server-side compute for large-scale analysis
- No collaboration or sharing features
- No centralized management
- Session data can be lost if browser storage cleared

### Target Use Cases

ALIENX is **designed for**:

- Individual security analysts and incident responders
- Small-to-medium log analysis (up to ~1GB, ~50k events)
- Privacy-sensitive investigations (no data leaving user's machine)
- Quick triage and detection validation
- Educational/demonstration purposes
- Users who cannot upload logs to external services

ALIENX is **not designed for**:

- Enterprise-scale log analysis (millions of events)
- Long-term log retention and correlation
- Team collaboration and case management
- Production SIEM replacement
- Continuous monitoring or alerting
- Centralized threat hunting across multiple systems

### Recommended Alternatives for Large-Scale Analysis

For enterprise-scale needs, consider:

- **Commercial SIEMs**: Splunk, QRadar, ArcSight, LogRhythm
- **Open-source SIEMs**: Elastic Security, Wazuh, Graylog
- **Cloud-native solutions**: Microsoft Sentinel, Sumo Logic, Datadog
- **Specialized tools**: Velociraptor, GRR, Timesketch

---

## Reporting Issues

If you encounter limitations not documented here, or have suggestions for improving the application within its design constraints, please:

1. Check existing GitHub issues: https://github.com/Koifman/ALIENX/issues
2. Open a new issue with:
   - Clear description of the limitation or problem
   - Steps to reproduce (if applicable)
   - Browser and OS details
   - Log file characteristics (size, event count, format)
   - Expected vs. actual behavior

---

## Contributing

Contributions that address limitations while maintaining the privacy-first, client-side architecture are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Note**: Contributions that require server-side processing, external dependencies, or compromise the zero-telemetry design will not be accepted.
