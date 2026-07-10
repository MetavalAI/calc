import os, json, re
from flask import Flask, render_template, jsonify, request, abort

app = Flask(__name__)

FORMULAS_DIR = os.path.join(app.root_path, "formulas")
os.makedirs(FORMULAS_DIR, exist_ok=True)

def safe_slug(name):
    s = re.sub(r"[^a-z0-9]+", "-", name.lower().strip())
    return s.strip("-")[:60]

def load_formula(filename):
    with open(os.path.join(FORMULAS_DIR, filename), encoding="utf-8") as fh:
        return json.load(fh)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/api/formulas", methods=["GET"])
def list_formulas():
    items = []
    for fname in sorted(os.listdir(FORMULAS_DIR)):
        if not fname.endswith(".json"):
            continue
        try:
            d = load_formula(fname)
            items.append({"filename":fname,"id":d.get("id",fname),"name":d.get("name",fname),
                          "tag":d.get("tag",""),"icon":d.get("icon","🔢"),"description":d.get("description","")})
        except Exception:
            pass
    return jsonify(items)

@app.route("/api/formulas/<filename>", methods=["GET"])
def get_formula(filename):
    if not filename.endswith(".json"): abort(400)
    path = os.path.join(FORMULAS_DIR, filename)
    if not os.path.exists(path): abort(404)
    return jsonify(load_formula(filename))

@app.route("/api/formulas", methods=["POST"])
def upload_formula():
    if request.files.get("file"):
        try: data = json.loads(request.files["file"].read())
        except Exception as e: return jsonify({"error":str(e)}), 400
    else:
        try: data = request.get_json(force=True)
        except Exception: return jsonify({"error":"No valid JSON"}), 400
    if not data or "name" not in data:
        return jsonify({"error":"'name' required"}), 400
    slug = safe_slug(data["name"])
    filename = f"{slug}.json"
    if "id" not in data: data["id"] = slug
    with open(os.path.join(FORMULAS_DIR, filename), "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)
    return jsonify({"ok":True,"filename":filename}), 201

@app.route("/api/formulas/<filename>", methods=["PUT"])
def update_formula(filename):
    if not filename.endswith(".json"): abort(400)
    path = os.path.join(FORMULAS_DIR, filename)
    if not os.path.exists(path): abort(404)
    data = request.get_json(force=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)
    return jsonify({"ok":True})

@app.route("/api/formulas/<filename>", methods=["DELETE"])
def delete_formula(filename):
    if not filename.endswith(".json"): abort(400)
    path = os.path.join(FORMULAS_DIR, filename)
    if not os.path.exists(path): abort(404)
    os.remove(path)
    return jsonify({"ok":True})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5555, debug=True)

# python app.py
# python -m http.server 5555
