/**
 * MYSTIC MOTION - Main Application Controller
 * Directly executes your Python main.py CV & VFX logic via /api/process,
 * with optional fallback to client-side WebAssembly execution.
 */

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const videoElement = document.getElementById("webcam");
  const canvasElement = document.getElementById("output-canvas");
  const ctx = canvasElement.getContext("2d", { willReadFrequently: false });

  // HUD Elements
  const heroNameEl = document.getElementById("current-hero-name");
  const statHandsEl = document.getElementById("stat-hands");
  const statFpsEl = document.getElementById("stat-fps");
  const statPoseEl = document.getElementById("stat-pose");
  const characterBadge = document.getElementById("character-badge");

  // Control Buttons
  const charButtons = document.querySelectorAll(".char-btn");
  const btnSound = document.getElementById("btn-sound");
  const iconSoundOff = document.getElementById("icon-sound-off");
  const iconSoundOn = document.getElementById("icon-sound-on");
  const btnMirror = document.getElementById("btn-mirror");
  const btnSwitchCam = document.getElementById("btn-switch-cam");
  const btnSnapshot = document.getElementById("btn-snapshot");
  const btnFullscreen = document.getElementById("btn-fullscreen");
  const btnHelp = document.getElementById("btn-help");
  const modalHelp = document.getElementById("help-modal");
  const modalClose = document.getElementById("modal-close");

  // Loading Screen Elements
  const loadingScreen = document.getElementById("loading-screen");
  const loadingTitle = document.getElementById("loading-title");
  const loadingDesc = document.getElementById("loading-desc");
  const btnStartCamera = document.getElementById("btn-start-camera");

  // Application State
  let currentHeroKey = "1";
  let isMirrored = true;
  let showHelpInHUD = true;
  let currentFacingMode = "user";
  let cameraStream = null;

  // Processing mode: "python" (executes main.py) or "client" (MediaPipe WASM)
  let executionMode = "python";
  let isSendingFrame = false;

  // Systems
  const audioSystem = new MysticAudio();
  let vfxRenderer = null;
  let handsModel = null;
  let isClientModelReady = false;

  // Offscreen canvas for grabbing video frames
  const offscreenCanvas = document.createElement("canvas");
  const offscreenCtx = offscreenCanvas.getContext("2d");

  // Check if Python backend is available
  async function detectBackend() {
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const data = await res.json();
        console.log("[Mystic Motion] Connected to Python CV Backend (main.py):", data);
        executionMode = "python";
        statPoseEl.textContent = "PYTHON MAIN.PY";
        return true;
      }
    } catch (e) {
      console.log("[Mystic Motion] Python endpoint unavailable, falling back to Client WASM mode.");
    }
    executionMode = "client";
    return false;
  }

  // Set theme colors based on selected hero
  function applyHeroTheme(key) {
    const hero = CHARACTERS[key];
    if (!hero) return;

    currentHeroKey = key;
    document.documentElement.style.setProperty("--hero-color", hero.color);
    document.documentElement.style.setProperty("--hero-accent", hero.accent);
    document.documentElement.style.setProperty("--hero-glow", hero.glow);

    heroNameEl.textContent = hero.name;
    audioSystem.playSpellActivation(key);

    charButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.char === key);
    });
  }

  // Adjust canvas resolution
  function resizeCanvas() {
    const width = videoElement.videoWidth || 1280;
    const height = videoElement.videoHeight || 720;

    if (canvasElement.width !== width || canvasElement.height !== height) {
      canvasElement.width = width;
      canvasElement.height = height;
      offscreenCanvas.width = width;
      offscreenCanvas.height = height;
    }
  }

  // Start Camera Stream
  async function startWebcam() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
    }

    try {
      const constraints = {
        video: {
          facingMode: currentFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      videoElement.srcObject = cameraStream;
      await videoElement.play();

      resizeCanvas();
      loadingScreen.classList.add("hidden");

      // Check backend health
      await detectBackend();

      if (executionMode === "client") {
        initClientMediaPipe();
      }

      // Begin continuous loop
      requestAnimationFrame(mainLoop);
    } catch (err) {
      console.error("Camera access error:", err);
      alert("Camera access denied or unavailable. Please grant webcam permissions.");
      loadingTitle.textContent = "CAMERA PERMISSION REQUIRED";
      loadingDesc.textContent = "Please allow webcam access in your browser to run Mystic Motion.";
    }
  }

  // ==========================================================================
  // Python main.py Execution Pipeline
  // ==========================================================================
  const displayImage = new Image();
  let lastPythonCall = performance.now();
  let pythonFps = 0;

  async function processPythonFrame() {
    if (isSendingFrame || videoElement.readyState < 2) return;
    isSendingFrame = true;

    try {
      // Draw frame to offscreen canvas
      offscreenCtx.drawImage(videoElement, 0, 0, offscreenCanvas.width, offscreenCanvas.height);
      const base64Data = offscreenCanvas.toDataURL("image/jpeg", 0.75);

      const response = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64Data,
          character: currentHeroKey,
          help: showHelpInHUD,
          mirror: isMirrored
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.image) {
          displayImage.onload = () => {
            ctx.drawImage(displayImage, 0, 0, canvasElement.width, canvasElement.height);
          };
          displayImage.src = result.image;
        }

        const now = performance.now();
        const dt = Math.max((now - lastPythonCall) / 1000.0, 1e-4);
        lastPythonCall = now;
        pythonFps = 0.9 * pythonFps + 0.1 * (1.0 / dt);

        statHandsEl.textContent = result.hands ?? 0;
        statFpsEl.textContent = Math.round(result.fps || pythonFps);
        statPoseEl.textContent = "PYTHON CV";
        audioSystem.updateMagicHum(result.hands || 0, currentHeroKey, false);
      } else {
        // If Python endpoint returns an error, fallback to client WASM
        console.warn("Python backend error, switching to client execution.");
        executionMode = "client";
        initClientMediaPipe();
      }
    } catch (err) {
      console.warn("Python backend unreachable, switching to client execution.", err);
      executionMode = "client";
      initClientMediaPipe();
    } finally {
      isSendingFrame = false;
    }
  }

  // ==========================================================================
  // Client-Side WASM MediaPipe Fallback Pipeline
  // ==========================================================================
  function initClientMediaPipe() {
    if (isClientModelReady) return;
    try {
      vfxRenderer = new MagicRenderer();
      handsModel = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      handsModel.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.55,
        minTrackingConfidence: 0.50
      });

      handsModel.onResults(onClientHandResults);
      isClientModelReady = true;
      statPoseEl.textContent = "CLIENT WASM";
    } catch (err) {
      console.error("Client MediaPipe initialization error:", err);
    }
  }

  let clientFps = 60.0;
  let lastClientTimestamp = performance.now();
  let inwardPoseUntil = 0.0;

  function onClientHandResults(results) {
    const now = performance.now() / 1000.0;
    const dt = Math.max(now - lastClientTimestamp, 1e-4);
    lastClientTimestamp = now;

    clientFps = 0.9 * clientFps + 0.1 * (1.0 / dt);
    statFpsEl.textContent = Math.round(clientFps);

    const w = canvasElement.width;
    const h = canvasElement.height;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    if (isMirrored) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(results.image, 0, 0, w, h);
    ctx.restore();

    const rawHands = results.multiHandLandmarks || [];
    statHandsEl.textContent = rawHands.length;

    const hands = rawHands.map((landmarks, idx) => {
      const points = landmarks.map((pt) => ({
        x: isMirrored ? 1.0 - pt.x : pt.x,
        y: pt.y,
        z: pt.z || 0
      }));
      return { points };
    });

    const hero = CHARACTERS[currentHeroKey];
    let isTwoHand = false;

    if (hands.length >= 2) {
      const inwardDetected = facingEachOther(hands[0], hands[1]);
      if (inwardDetected) inwardPoseUntil = now + 0.22;
      const inwardPose = now < inwardPoseUntil;
      const cameraPose = palmsFaceCamera(hands[0], hands[1]);

      if (inwardPose) {
        isTwoHand = true;
        vfxRenderer.renderTwoHandField(ctx, hero, hands, now, w, h);
      } else {
        hands.forEach((hand, id) => {
          vfxRenderer.renderHand(ctx, hero, hand, now, id, w, h);
        });
        if (cameraPose) {
          isTwoHand = true;
          vfxRenderer.renderTwoHandField(ctx, hero, hands, now, w, h);
        }
      }
    } else if (hands.length === 1) {
      vfxRenderer.renderHand(ctx, hero, hands[0], now, 0, w, h);
    }

    audioSystem.updateMagicHum(hands.length, currentHeroKey, isTwoHand);
  }

  // ==========================================================================
  // Main Execution Loop
  // ==========================================================================
  async function mainLoop() {
    if (videoElement.readyState >= 2) {
      if (executionMode === "python") {
        await processPythonFrame();
      } else if (executionMode === "client" && isClientModelReady) {
        await handsModel.send({ image: videoElement });
      }
    }
    requestAnimationFrame(mainLoop);
  }

  // ==========================================================================
  // User Controls & Event Listeners
  // ==========================================================================
  btnStartCamera.addEventListener("click", () => {
    audioSystem.init();
    startWebcam();
  });

  charButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      applyHeroTheme(btn.dataset.char);
    });
  });

  btnSound.addEventListener("click", () => {
    const isMuted = !audioSystem.toggle();
    iconSoundOff.classList.toggle("hidden", !isMuted);
    iconSoundOn.classList.toggle("hidden", isMuted);
    btnSound.classList.toggle("active", !isMuted);
  });

  btnMirror.addEventListener("click", () => {
    isMirrored = !isMirrored;
    btnMirror.classList.toggle("active", isMirrored);
  });

  btnSwitchCam.addEventListener("click", () => {
    currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
    startWebcam();
  });

  btnFullscreen.addEventListener("click", () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });

  btnSnapshot.addEventListener("click", () => {
    const link = document.createElement("a");
    link.download = `mystic-motion-${CHARACTERS[currentHeroKey].name.toLowerCase()}-${Date.now()}.png`;
    link.href = canvasElement.toDataURL("image/png");
    link.click();
  });

  btnHelp.addEventListener("click", () => {
    modalHelp.classList.remove("hidden");
  });
  modalClose.addEventListener("click", () => {
    modalHelp.classList.add("hidden");
  });
  modalHelp.addEventListener("click", (e) => {
    if (e.target === modalHelp) modalHelp.classList.add("hidden");
  });

  window.addEventListener("keydown", (e) => {
    const key = e.key;
    if (key >= "1" && key <= "5") {
      applyHeroTheme(key);
    } else if (key.toLowerCase() === "m") {
      btnMirror.click();
    } else if (key.toLowerCase() === "s") {
      btnSound.click();
    } else if (key.toLowerCase() === "h") {
      showHelpInHUD = !showHelpInHUD;
      modalHelp.classList.toggle("hidden");
    } else if (key.toLowerCase() === "f") {
      btnFullscreen.click();
    } else if (key === " " || key === "Spacebar") {
      e.preventDefault();
      btnSnapshot.click();
    }
  });

  window.addEventListener("resize", resizeCanvas);

  applyHeroTheme("1");
  btnMirror.classList.add("active");
  btnStartCamera.classList.remove("hidden");
  loadingTitle.textContent = "MYSTIC MOTION READY";
  loadingDesc.textContent = "Click Activate to connect your camera directly to the Python CV Engine.";
});
