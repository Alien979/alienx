# 👽 AlienX - SIGMA Detection & EVTX Analyzer

AlienX is a high-performance web-based tool designed to analyze Windows Event Logs (`.evtx`) against the global **SIGMA** detection rule standard.

## 🛠️ Prerequisites

Before building the project, ensure you have the following installed on your Kali system:

* **Node.js** (v18.x or higher recommended)
* **npm**
* **Git**

## 🚀 Installation & Setup

Because this project relies on external detection rules, follow these steps to initialize the environment:

### 1. Clone the Repository

```bash
git clone https://github.com/Alien979/alienx.git
cd alienx-main-new

```

### 2. Install Dependencies

```bash
npm install

```

### 3. Initialize Sigma Rules

The build script requires the SigmaHQ rules to be present in the source folder. Run these commands to pull the latest rules:

```bash
mkdir -p src/sigma-master
git clone https://github.com/SigmaHQ/sigma.git src/sigma-master

```

## 🏗️ Build Process

To compile the application and bundle the **2,300+** detection rules, run:

```bash
npm run build

```

### What happens during the build?

1. **Sync:** Checks for updates in the `sigma-master` directory.
2. **Bundle:** Compresses `.yml` rules into optimized JSON categories in `public/sigma-rules/`.
3. **Generate Samples:** Creates a manifest for the 266+ included EVTX samples.
4. **Compile:** Runs `tsc` (TypeScript) and `vite build` to create the production files.

## 📊 Detection Capabilities

The current build includes a comprehensive library of Windows-focused detection rules:

| Category | Rules Count | Description |
| --- | --- | --- |
| **Process Creation** | 1,160+ | Monitors for malicious execution (LOLBins, Mimikatz). |
| **Registry** | 240+ | Detects persistence and UAC bypasses. |
| **PowerShell** | 200+ | Identifies obfuscated scripts and fileless attacks. |
| **Network/DNS** | 70+ | Flags C2 communication and data exfiltration. |

## 🖥️ Development

To start a local development server with hot-reload:

```bash
npm run dev

```

The app will be available at `http://localhost:5173`.
