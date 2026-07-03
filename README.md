# OpenSciDraw

> **The zero-cost, local-first, high-performance open-source alternative to BioRender.** Create publication-ready scientific figures, pathway diagrams, laboratory setups, and conference posters instantly in your browser at 120 FPS at up to 8K resolution.

---

## 🚀 Key Features

*   **⚡ WebGPU Hardware-Accelerated Rendering Core**
    Smoothly manage and render over 150,000 vector paths, lipid bilayer units, cell structures, and tissue scaffolds at a locked 120 FPS. Perfect for multi-panel, print-ready 8K resolutions.
*   **🤝 Local-First P2P Collaboration (CRDT & WebRTC)**
    Real-time concurrent collaboration using Yjs CRDTs and WebRTC signaling. Co-author pathway layouts with lab mates directly browser-to-browser with zero central server overhead or latency.
*   **🧪 WebAssembly-Powered Cheminformatics Core**
    Inject chemically accurate molecular structures from SMILES representations or IUPAC names directly into your workspace. Atoms and bonds are generated as fully editable vectors that can be scaled and recolored.
*   **🔌 Secure, Sandboxed Developer API**
    Extend the application by writing custom automation scripts or ingesting external data using isolated Web Worker sandboxes that prevent UI thread blocking.
*   **📋 Compliant Reference & Citation Builder**
    Auto-generate academic attribution lists and export citation blocks (including BibTeX formats) for all vector libraries used in your figures.

---

## 💡 The Problem OpenSciDraw Solves

Modern academic and industrial research is often constrained by legacy scientific design software that locks publication-quality exports, workspace dimensions, and collaborative features behind expensive subscription paywalls. 

**OpenSciDraw** provides a completely free, community-driven, local-first platform designed to equalize access to high-fidelity scientific illustrations. By running all computations—from WebAssembly chemical layout parsing to WebGPU pixel rasterization—directly inside the client's browser sandbox, OpenSciDraw requires zero backend server cost, ensuring lifetime availability for researchers worldwide.

---

## 🛠️ Quick Start

Follow these steps to run the interactive scientific visualization canvas locally:

### Prerequisites

*   **Node.js** (v18 or higher recommended)
*   **npm** or **yarn**

### Installation

Clone the repository and install the development dependencies:

```bash
# Clone the repository
git clone https://github.com/yagamilight-pk/OpenScidraw.git
cd OpenScidraw

# Install packages
npm install
```

### Running Locally

Launch the Vite local development server:

```bash
npm run dev
```

The application will be served at [http://localhost:5173/](http://localhost:5173/).

### Production Build

Compile the static, highly optimized production assets:

```bash
npm run build
```