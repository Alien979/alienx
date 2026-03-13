# ALIENX

ALIENX is a client-side forensic log analysis application with SIGMA-based detection support.

## Supported Analysis Platforms

- Windows: EVTX/XML ingestion, existing Windows-focused analytics and Sigma workflows.
- Linux: folder and ZIP ingestion for common evidence exports (journal JSON, auditd logs, syslog/auth/messages).

## Linux Evidence Collection and Supported Formats

Recommended Linux evidence sources:

- `journalctl -o json` exports (`.json`, `.jsonl`, `.ndjson`)
- `auditd` logs (`audit.log`)
- Syslog-style logs (`syslog`, `messages`, `auth.log`, `secure`, `kern.log`)

Linux ingestion supports:

- Uploading multiple files
- Uploading full folders (recursive via browser folder input)
- Uploading ZIP archives containing supported files

The app parses supported files, merges events, and runs Sigma detections using Linux rules.

## Building Rule Bundles

To build platform-specific Sigma bundles:

```bash
npm run bundle:sigma
```

This generates:

- `public/sigma-rules/windows/manifest.json`
- `public/sigma-rules/linux/manifest.json`

## Community YARA Rule Sources

ALIENX can pull community-maintained YARA repositories for broader malware signature coverage.

To sync community YARA rules and generate a local manifest:

```bash
npm run sync:yara
```

This pulls/updates:

- `Yara-Rules/rules`
- `Neo23x0/signature-base`
- `reversinglabs/reversinglabs-yara-rules`
- `advanced-threat-research/Yara-Rules`
- `elastic/protections-artifacts`

and writes metadata to:

- `public/yara-rules/manifest.json`

Notes:

- YARA ecosystem coverage is broad but never literally "everything"; refresh sources regularly.
- Keep Sigma and YARA sources current with:

```bash
npm run refresh:rules
```
