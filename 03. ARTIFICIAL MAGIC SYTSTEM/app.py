import base64
import time
from pathlib import Path
from flask import Flask, Response, request, jsonify, send_from_directory
import cv2
import numpy as np

# Import local CV modules
import sys
ROOT_DIR = Path(__file__).resolve().parent
SRC_DIR = ROOT_DIR / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.append(str(SRC_DIR))

from config import CHARACTERS
from main import MysticMotionEngine

app = Flask(__name__, static_folder=".", static_url_path="")

engine = MysticMotionEngine(max_hands=2)

@app.route("/")
def index():
    return send_from_directory(str(ROOT_DIR), "index.html")

@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(str(ROOT_DIR), path)

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "online",
        "system": "Mystic Motion Python CV Engine",
        "characters": [c.name for c in CHARACTERS.values()]
    })

@app.route("/api/process", methods=["POST"])
def process():
    """Processes a webcam frame directly using main.py and returns the exact OpenCV output."""
    data = request.get_json(silent=True) or {}
    image_data = data.get("image")
    character_key = str(data.get("character", "1"))
    show_help = bool(data.get("help", True))
    mirror = bool(data.get("mirror", True))

    if not image_data:
        return jsonify({"error": "No image payload received"}), 400

    try:
        if "," in image_data:
            image_data = image_data.split(",", 1)[1]

        image_bytes = base64.b64decode(image_data)
        np_arr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if frame is None:
            return jsonify({"error": "Failed to decode image frame"}), 400

        processed_frame, hands_count, fps = engine.process_frame(
            frame,
            character_key=character_key,
            show_help=show_help,
            mirror=mirror
        )

        ok, buf = cv2.imencode(".jpg", processed_frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        if not ok:
            return jsonify({"error": "Failed to encode output frame"}), 500

        result_b64 = base64.b64encode(buf).decode("utf-8")
        return jsonify({
            "image": f"data:image/jpeg;base64,{result_b64}",
            "hands": hands_count,
            "fps": round(fps)
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    print("\n[MYSTIC MOTION] Starting local Python server...")
    print("Serving client web interface at http://localhost:5000")
    print("Live API endpoint at http://localhost:5000/api/process")
    app.run(host="0.0.0.0", port=5000, debug=False)
