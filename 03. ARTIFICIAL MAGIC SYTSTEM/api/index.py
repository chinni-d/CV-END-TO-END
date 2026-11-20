import base64
import sys
from pathlib import Path
from flask import Flask, request, jsonify

# Add src to Python path
ROOT_DIR = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT_DIR / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.append(str(SRC_DIR))

import cv2
import numpy as np
from main import MysticMotionEngine
from config import CHARACTERS

app = Flask(__name__)

# Global engine instance for serverless / WSGI reuse
_engine = None

def get_engine():
    global _engine
    if _engine is None:
        _engine = MysticMotionEngine(max_hands=2)
    return _engine

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "online",
        "system": "Mystic Motion Python CV Engine",
        "characters": [c.name for c in CHARACTERS.values()]
    })

@app.route("/api/process", methods=["POST"])
def process():
    """
    Receives a webcam image frame, processes it directly using
    main.py's exact HandTracker, MagicRenderer, and draw_hud(),
    and returns the processed OpenCV image.
    """
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

        engine = get_engine()
        processed_frame, hands_count, fps = engine.process_frame(
            frame,
            character_key=character_key,
            show_help=show_help,
            mirror=mirror
        )

        # Encode back to JPEG
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
    app.run(port=5000)
