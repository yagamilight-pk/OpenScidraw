import os
import json
import hashlib
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

RAW_DIR = Path("vectors/raw")
OPTIMIZED_DIR = Path("vectors/optimized")
DATA_FEED_DIR = Path("data-feed")
MANIFEST_PATH = DATA_FEED_DIR / "manifest.json"
PUBLIC_OPTIMIZED_DIR = Path("public/vectors/optimized")
PUBLIC_MANIFEST_PATH = Path("public/data-feed/manifest.json")
SCHEMA_VERSION = "1.0.0"

ET.register_namespace("", "http://www.w3.org/2000/svg")
ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")

CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "Cytology & Immunology": [
        "cell", "macrophage", "lymphocyte", "neutrophil", "t-cell", "b-cell",
        "nk-cell", "dendritic", "monocyte", "platelet", "erythrocyte",
        "leukocyte", "cytokine", "antibody", "antigen", "receptor",
        "membrane", "cytoplasm", "nucleus", "mitochondria", "lysosome",
        "vacuole", "ribosome", "golgi", "endoplasmic", "vesicle", "immune",
        "inflammation", "phagocyte", "mast", "basophil", "eosinophil",
        "plasma", "stem", "progenitor", "megakaryocyte", "histamine",
        "complement", "interferon", "interleukin", "tumor", "necrosis",
    ],
    "Molecular Biology": [
        "dna", "rna", "mrna", "protein", "gene", "genome", "chromosome",
        "plasmid", "vector", "pcr", "sequencing", "primer", "helix",
        "nucleotide", "base", "adenine", "thymine", "guanine", "cytosine",
        "uracil", "codon", "ribosome", "transcription", "translation",
        "replication", "mutation", "allele", "phenotype", "genotype",
        "promoter", "enhancer", "silencer", "exon", "intron", "splicing",
        "gel", "electrophoresis", "blot", "western", "southern", "northern",
        "crispr", "cas9", "knockout", "knockin", "transfection", "expression",
        "cloning", "restriction", "enzyme", "ligase", "polymerase", "helicase",
    ],
    "Laboratory Equipment": [
        "beaker", "flask", "tube", "microscope", "centrifuge", "pipette",
        "micropipette", "syringe", "needle", "petri", "dish", "plate",
        "vial", "bottle", "burette", "graduated", "cylinder", "funnel",
        "condenser", "reflux", "autoclave", "incubator", "cabinet", "hood",
        "biosafety", "laminar", "flow", "spectrophotometer", "cuvette",
        "gel", "box", "power", "supply", "transilluminator", "thermocycler",
        "pcr", "machine", "rotary", "evaporator", "magnetic", "stirrer",
        "balance", "scale", "ph", "meter", "probe", "electrode", "chart",
        "timer", "rack", "stand", "clamp", "forceps", "spatula", "scalpel",
        "scissors", "tweezer", "mortar", "pestle", "hot", "cold",
    ],
    "Anatomy & Organ Systems": [
        "heart", "lung", "liver", "kidney", "brain", "spleen", "stomach",
        "intestine", "colon", "pancreas", "thyroid", "adrenal", "bladder",
        "uterus", "ovary", "testis", "prostate", "gallbladder", "trachea",
        "esophagus", "aorta", "vein", "artery", "muscle", "bone", "cartilage",
        "joint", "spine", "vertebra", "rib", "skull", "femur", "tibia",
        "fibula", "humerus", "radius", "ulna", "pelvis", "neuron", "synapse",
        "nerve", "axon", "dendrite", "glial", "astrocyte", "skin", "dermis",
        "epidermis", "hair", "follicle", "sweat", "sebaceous", "cornea",
        "retina", "cochlea", "alveoli", "nephron", "glomerulus", "hepatocyte",
    ],
}

def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()

def classify_asset(filename: str) -> str:
    stem = Path(filename).stem.lower()
    tokens = re.split(r"[\s_\-\.]+", stem)
    scores: dict[str, int] = {cat: 0 for cat in CATEGORY_KEYWORDS}
    for token in tokens:
        for cat, keywords in CATEGORY_KEYWORDS.items():
            if any(token == kw or token.startswith(kw[:4]) for kw in keywords):
                scores[cat] += 1
    best = max(scores, key=lambda c: scores[c])
    return best if scores[best] > 0 else "General"

def extract_keywords(filename: str) -> list[str]:
    stem = Path(filename).stem.lower()
    tokens = re.split(r"[\s_\-\.]+", stem)
    return [t for t in tokens if len(t) > 2]

def strip_numeric(val: Optional[str]) -> Optional[float]:
    if not val:
        return None
    cleaned = re.sub(r"[^\d.]", "", str(val))
    try:
        return float(cleaned) if cleaned else None
    except ValueError:
        return None

def compute_viewbox(root: ET.Element, width_str: Optional[str], height_str: Optional[str]) -> str:
    w = strip_numeric(width_str)
    h = strip_numeric(height_str)
    if w and h:
        return f"0 0 {int(w)} {int(h)}"
    return "0 0 100 100"

def inject_color_hooks(root: ET.Element) -> int:
    ns = {"svg": "http://www.w3.org/2000/svg"}
    hookable_tags = {"path", "rect", "circle", "ellipse", "polygon", "polyline", "line", "text", "tspan", "g"}
    hook_count = 0
    idx = 0
    for elem in root.iter():
        local = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag
        if local not in hookable_tags:
            continue
        hook_id = f"hook_{idx:04d}"
        elem.set("data-osd-hook", hook_id)
        style = elem.get("style", "")
        style_parts: dict[str, str] = {}
        for part in style.split(";"):
            if ":" in part:
                k, v = part.split(":", 1)
                style_parts[k.strip().lower()] = v.strip()
        fill = style_parts.get("fill") or elem.get("fill")
        stroke = style_parts.get("stroke") or elem.get("stroke")
        if fill and fill.lower() not in ("none", "transparent", "") and not fill.lower().startswith("url("):
            elem.set("fill", "currentColor")
            elem.set("data-osd-fill-original", fill)
            if "fill" in style_parts:
                style_parts["fill"] = "currentColor"
            hook_count += 1
        if stroke and stroke.lower() not in ("none", "transparent", "") and not stroke.lower().startswith("url("):
            elem.set("stroke", "currentColor")
            elem.set("data-osd-stroke-original", stroke)
            if "stroke" in style_parts:
                style_parts["stroke"] = "currentColor"
        if style_parts:
            elem.set("style", ";".join(f"{k}:{v}" for k, v in style_parts.items()))
        idx += 1
    return hook_count

def process_svg(src: Path, dst: Path) -> Optional[dict]:
    try:
        tree = ET.parse(src)
        root = tree.getroot()
    except ET.ParseError as e:
        print(f"[PARSE ERROR] {src}: {e}", file=sys.stderr)
        return None

    width_attr = root.get("width")
    height_attr = root.get("height")
    existing_viewbox = root.get("viewBox") or root.get("viewbox")

    if not existing_viewbox:
        vb = compute_viewbox(root, width_attr, height_attr)
        root.set("viewBox", vb)
    else:
        vb = existing_viewbox

    root.attrib.pop("width", None)
    root.attrib.pop("height", None)
    root.set("xmlns", "http://www.w3.org/2000/svg")
    root.set("data-osd-version", SCHEMA_VERSION)

    hook_count = inject_color_hooks(root)

    dst.parent.mkdir(parents=True, exist_ok=True)
    try:
        tree.write(str(dst), encoding="utf-8", xml_declaration=False)
    except Exception as e:
        print(f"[WRITE ERROR] {dst}: {e}", file=sys.stderr)
        return None

    checksum = sha256_file(dst)
    file_size = dst.stat().st_size
    return {
        "viewBox": vb,
        "hookCount": hook_count,
        "hasCurrentColor": hook_count > 0,
        "fileSizeBytes": file_size,
        "checksum": checksum,
    }

def build_manifest(entries: list[dict]) -> dict:
    category_counts: dict[str, int] = {
        "Cytology & Immunology": 0,
        "Molecular Biology": 0,
        "Laboratory Equipment": 0,
        "Anatomy & Organ Systems": 0,
        "General": 0,
    }
    for e in entries:
        cat = e.get("category", "General")
        if cat in category_counts:
            category_counts[cat] += 1
        else:
            category_counts["General"] += 1

    return {
        "version": SCHEMA_VERSION,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "totalAssets": len(entries),
        "categories": category_counts,
        "assets": entries,
    }

def friendly_name(stem: str) -> str:
    cleaned = re.sub(r"[\s_\-]+", " ", stem)
    return " ".join(w.capitalize() for w in cleaned.split())

SERVIER_SOURCES = {
    "macrophage": ("Servier Medical Art", "Servier", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0/", "https://smart.servier.com/"),
    "dna": ("Servier Medical Art", "Servier", "CC BY 3.0", "https://creativecommons.org/licenses/by/3.0/", "https://smart.servier.com/"),
}

def resolve_attribution(stem: str) -> dict:
    key = stem.lower().split("_")[0]
    if key in SERVIER_SOURCES:
        src, auth, lic, licurl, origurl = SERVIER_SOURCES[key]
        return {"source": src, "author": auth, "license": lic, "licenseUrl": licurl, "originalUrl": origurl}
    return {
        "source": "OpenSciDraw Community",
        "author": "OpenSciDraw Contributors",
        "license": "CC0 1.0",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
        "originalUrl": "https://github.com/openscidraw/openscidraw",
    }

def main():
    print(f"[PIPELINE] OpenSciDraw Asset Processor v{SCHEMA_VERSION}")
    print(f"[PIPELINE] Start: {datetime.now(timezone.utc).isoformat()}")

    OPTIMIZED_DIR.mkdir(parents=True, exist_ok=True)
    DATA_FEED_DIR.mkdir(parents=True, exist_ok=True)

    if not RAW_DIR.exists():
        print(f"[WARN] Raw directory '{RAW_DIR}' not found. Generating empty manifest.", file=sys.stderr)
        manifest = build_manifest([])
        MANIFEST_PATH.write_text(json.dumps(manifest, separators=(",", ":")), encoding="utf-8")
        print(f"[OK] Empty manifest written to {MANIFEST_PATH}")
        return

    svg_files = sorted(RAW_DIR.rglob("*.svg"))
    if not svg_files:
        print(f"[WARN] No SVG files found under '{RAW_DIR}'. Writing empty manifest.", file=sys.stderr)
        manifest = build_manifest([])
        MANIFEST_PATH.write_text(json.dumps(manifest, separators=(",", ":")), encoding="utf-8")
        return

    print(f"[PIPELINE] Discovered {len(svg_files)} raw SVG(s)")

    processed_entries: list[dict] = []
    error_count = 0

    for svg_path in svg_files:
        stem = svg_path.stem
        asset_id = re.sub(r"[\s\-]+", "_", stem.lower())
        relative_category_folder = svg_path.parent.relative_to(RAW_DIR).parts
        category = relative_category_folder[0] if relative_category_folder else classify_asset(svg_path.name)
        if category not in CATEGORY_KEYWORDS:
            category = classify_asset(svg_path.name)

        optimized_filename = f"{asset_id}.svg"
        dst = OPTIMIZED_DIR / optimized_filename

        print(f"  [PROCESS] {svg_path.name} -> {dst.name} [{category}]")
        result = process_svg(svg_path, dst)

        if result is None:
            error_count += 1
            continue

        attribution = resolve_attribution(stem)
        keywords = extract_keywords(svg_path.name)

        entry = {
            "id": asset_id,
            "name": friendly_name(stem),
            "category": category,
            "path": f"/vectors/raw/{svg_path.relative_to(RAW_DIR).as_posix()}",
            "optimizedPath": f"/vectors/optimized/{optimized_filename}",
            "keywords": keywords,
            "attribution": attribution,
            "viewBox": result["viewBox"],
            "hasCurrentColor": result["hasCurrentColor"],
            "hookCount": result["hookCount"],
            "fileSizeBytes": result["fileSizeBytes"],
            "checksum": result["checksum"],
            "indexedAt": datetime.now(timezone.utc).isoformat(),
        }
        processed_entries.append(entry)

    manifest = build_manifest(processed_entries)
    manifest_json = json.dumps(manifest, separators=(",", ":"))
    MANIFEST_PATH.write_text(manifest_json, encoding="utf-8")
    print(f"[OK] Manifest written -> {MANIFEST_PATH} ({len(manifest_json)} bytes)")

    import shutil
    PUBLIC_OPTIMIZED_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    for f in OPTIMIZED_DIR.glob("*.svg"):
        shutil.copy2(f, PUBLIC_OPTIMIZED_DIR / f.name)
    shutil.copy2(MANIFEST_PATH, PUBLIC_MANIFEST_PATH)
    print(f"[OK] Copied assets to public/ for dev server")

    print(f"[PIPELINE] Complete: {len(processed_entries)} optimized, {error_count} errors")
    if error_count:
        sys.exit(1)

if __name__ == "__main__":
    main()
