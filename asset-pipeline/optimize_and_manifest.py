import os
import xml.etree.ElementTree as ET
import json
import re

RAW_DIR = "vectors/raw"
OPTIMIZED_DIR = "vectors/optimized"
MANIFEST_PATH = "data-feed/manifest.json"

# Register SVG namespace to prevent ET prefixing (like 'ns0:')
ET.register_namespace('', 'http://www.w3.org/2000/svg')

def clean_value(val):
    if not val:
        return ""
    return re.sub(r'[^\d.]', '', val)

def process_svg(src_path, dest_path):
    try:
        tree = ET.parse(src_path)
        root = tree.getroot()
        
        # 1. Strip absolute layout heights/widths and set viewBox
        width_str = root.attrib.pop('width', None)
        height_str = root.attrib.pop('height', None)
        
        viewbox = root.attrib.get('viewBox', None)
        if not viewbox:
            w_val = clean_value(width_str)
            h_val = clean_value(height_str)
            if w_val and h_val:
                root.attrib['viewBox'] = f"0 0 {w_val} {h_val}"
            else:
                root.attrib['viewBox'] = "0 0 100 100"
        
        if 'xmlns' not in root.attrib:
            root.attrib['xmlns'] = "http://www.w3.org/2000/svg"
            
        # 2. Inject standardized color properties
        for elem in root.iter():
            if elem == root:
                continue
                
            tag_local = elem.tag.split('}')[-1]
            if tag_local not in ['path', 'rect', 'circle', 'polygon', 'polyline', 'line', 'ellipse']:
                continue
                
            style = elem.attrib.get('style', '')
            if style:
                parts = []
                for part in style.split(';'):
                    if not part.strip():
                        continue
                    if ':' in part:
                        k, v = part.split(':', 1)
                        k = k.strip().lower()
                        v = v.strip().lower()
                        if k == 'fill' and v != 'none' and not v.startswith('url('):
                            v = 'currentColor'
                        elif k == 'stroke' and v != 'none' and not v.startswith('url('):
                            v = 'currentColor'
                        parts.append(f"{k}:{v}")
                elem.attrib['style'] = ";".join(parts)
            
            fill = elem.attrib.get('fill', None)
            if fill is not None:
                fill_lower = fill.strip().lower()
                if fill_lower != 'none' and not fill_lower.startswith('url('):
                    elem.attrib['fill'] = 'currentColor'
            
            stroke = elem.attrib.get('stroke', None)
            if stroke is not None:
                stroke_lower = stroke.strip().lower()
                if stroke_lower != 'none' and not stroke_lower.startswith('url('):
                    elem.attrib['stroke'] = 'currentColor'
                    
            if 'fill' not in elem.attrib and 'stroke' not in elem.attrib and 'style' not in elem.attrib:
                elem.attrib['fill'] = 'currentColor'
                
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        tree.write(dest_path, encoding='utf-8', xml_declaration=False)
        print(f"Optimized: {src_path} -> {dest_path}")
        return True
    except Exception as e:
        print(f"Error processing SVG {src_path}: {e}")
        return False

def main():
    print("Starting OpenSciDraw vector optimization engine...")
    assets = []
    
    special_names = {
        "dna": "DNA Helix",
        "macrophage": "Macrophage Cell",
        "beaker": "Laboratory Beaker"
    }
    
    if not os.path.exists(RAW_DIR):
        print(f"Error: Raw directory '{RAW_DIR}' does not exist.")
        return
        
    for root_dir, dirs, files in os.walk(RAW_DIR):
        for file in files:
            if not file.lower().endswith('.svg'):
                continue
                
            src_file_path = os.path.join(root_dir, file)
            relative_dir = os.path.relpath(root_dir, RAW_DIR)
            if relative_dir == ".":
                category = "General"
            else:
                category = relative_dir.replace("\\", "/").split("/")[0].title()
                
            file_base = os.path.splitext(file)[0]
            
            asset_id = f"cell_{file_base}" if file_base == "macrophage" else file_base
            if asset_id == file_base and file_base not in ["dna", "beaker"]:
                asset_id = f"{category.lower()}_{file_base}"
                
            name = special_names.get(file_base.lower())
            if not name:
                name = file_base.replace('_', ' ').replace('-', ' ').title()
                
            dest_file_name = file
            dest_file_path = os.path.join(OPTIMIZED_DIR, dest_file_name)
            
            success = process_svg(src_file_path, dest_file_path)
            if success:
                assets.append({
                    "id": asset_id,
                    "category": category,
                    "name": name,
                    "path": f"/vectors/optimized/{dest_file_name}"
                })
                
    os.makedirs(os.path.dirname(MANIFEST_PATH), exist_ok=True)
    manifest = { "assets": assets }
    with open(MANIFEST_PATH, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)
        
    print(f"Manifest written successfully to {MANIFEST_PATH}")
    print(f"Processed {len(assets)} assets total.")

    import shutil
    public_optimized_dir = os.path.join("public", "vectors", "optimized")
    public_manifest_path = os.path.join("public", "data-feed", "manifest.json")
    
    if os.path.exists(OPTIMIZED_DIR):
        if os.path.exists(public_optimized_dir):
            shutil.rmtree(public_optimized_dir)
        shutil.copytree(OPTIMIZED_DIR, public_optimized_dir)
        print(f"Copied optimized vectors to {public_optimized_dir}")
        
    if os.path.exists(MANIFEST_PATH):
        os.makedirs(os.path.dirname(public_manifest_path), exist_ok=True)
        shutil.copy2(MANIFEST_PATH, public_manifest_path)
        print(f"Copied manifest to {public_manifest_path}")

if __name__ == "__main__":
    main()
