# MYSTIC MOTION | AI Palm Magic & Computer Vision System

A real-time Computer Vision magic experience inspired by Marvel sorcerers (**Doctor Strange**, **Scarlet Witch**, **Agatha Harkness**, **Loki**, and **Thor**). Powered by MediaPipe hand tracking and GPU-accelerated canvas visual effects.

---

## ⚡ Architecture & Vercel Deployment

### Why a Modern Web Frontend is Required for Vercel:
1. **Serverless Camera Limitation**: Vercel runs on cloud serverless infrastructure with **no physical webcam** and **no GUI display**. Running `cv2.VideoCapture(0)` or `cv2.imshow()` on a serverless function fails immediately because there is no hardware camera or monitor.
2. **Real-time 60 FPS Performance**: Sending 30–60 raw video frames per second over HTTP POST to a cloud backend introduces 500ms–1500ms of network latency. In contrast, running **MediaPipe via WebAssembly & WebGL on the client** gives **instant 60 FPS tracking with 0ms network latency** directly on the user's GPU.
3. **Vercel 250MB Limit**: Python libraries like `mediapipe` (~150MB) and `opencv-python` (~120MB) exceed Vercel's 250MB uncompressed bundle limit. By channeling MediaPipe through modern browser WASM, deployment size is under **1 MB** and loads worldwide in milliseconds on Vercel's global Edge CDN.

---

## 🚀 How to Deploy to Vercel (2 Simple Ways)

### Option 1: Deploy with Git & Vercel Dashboard (Recommended)
1. Push your repository to **GitHub**, **GitLab**, or **Bitbucket**:
   ```bash
   git init
   git add .
   git commit -m "feat: Mystic Motion Web VFX system"
   git remote add origin <YOUR_GITHUB_REPO_URL>
   git branch -M main
   git push -u origin main
   ```
2. Go to [vercel.com](https://vercel.com) and log in.
3. Click **"Add New..."** -> **"Project"**.
4. Select your GitHub repository and click **"Deploy"**.
5. *Done!* Your web app is live at `https://<your-project>.vercel.app`.

### Option 2: Deploy directly from the Terminal with Vercel CLI
Run the following command in this directory:
```bash
npx vercel
```
Follow the interactive prompts (use default options), and your app will be deployed in seconds!

---

## 💻 Running Locally

### 1. Test the Web App Locally (Exact Vercel experience)
You can run any local static HTTP server, for example:
```bash
# Using Python's built-in server:
python -m http.server 3000

# Or using Node:
npx serve .
```
Then open `http://localhost:3000` in your browser.

### 2. Test with Local Python Flask Server
If you have Python installed with the dependencies in `requirements.txt`:
```bash
pip install -r requirements.txt
python app.py
```
Open `http://localhost:5000` to interact with the web interface.

### 3. Run Native Python OpenCV Desktop Window
```bash
python src/main.py
```

---

## 🔮 Characters & Magical Effects

| Key | Character | Signature Magic | Visual Characteristics |
|---|---|---|---|
| **1** | **Doctor Strange** | Eldritch Sorcerer Mandala | Rotating multi-tier geometric mandalas (8-gon, 4-gon, 6-gon), orange/gold sparks, energy core |
| **2** | **Scarlet Witch** | Chaos Magic | Orbiting crimson hex ellipses, flowing chaotic tendrils, reality-distortion particle clouds |
| **3** | **Agatha Harkness** | Dark Witchfire | Violet eldritch rings, counter-rotating dark magic runes, shadowy purple mist |
| **4** | **Loki** | Trickster Illusions | Shifting emerald geometry, green trickster aura, golden-green jade particles |
| **5** | **Thor** | Thunder & Lightning | Procedural branching jagged lightning bolts extending from palm and fingers, electric blue/gold thunder aura |

---

## ✋ Gestures & Interactions

- **Single Open Palm**: Activates individual palm magic circles and character particles.
- **Two Palms Facing Each Other**: Bridges both hands into a massive central **Convergence Vortex** / energy orb that dynamically scales with hand separation and movement speed.
- **Two Palms Facing Camera**: Triggers an intense **Camera Blast Shield** pushing forward.
- **Rapid Movement**: Spreading hands apart rapidly surges the particle field and bloom brightness.

---

## ⌨️ Controls & Shortcuts

- <kbd>1</kbd> - <kbd>5</kbd>: Switch Character
- <kbd>M</kbd>: Toggle Mirror Camera
- <kbd>S</kbd>: Toggle Procedural Web Audio Synthesizer (Spell Sounds)
- <kbd>Space</kbd>: Capture high-resolution photo with magic VFX
- <kbd>F</kbd>: Toggle Fullscreen
- <kbd>H</kbd>: Toggle Help & Gestures Modal
- **Switch Camera Button**: Switches between front and back camera on mobile smartphones
