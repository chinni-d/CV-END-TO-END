/**
 * MYSTIC MOTION - Mobile-First Application Controller
 * Handles MediaPipe AI Hand Tracking, Webcam Stream, HUD, and Canvas VFX.
 * Clean, lightweight, zero audio.
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

  // Controls
  const charButtons = document.querySelectorAll(".dock-item");
  const btnSnapshot = document.getElementById("btn-snapshot");
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
  const isMirrored = true; // Natural selfie mirror by default
  let cameraStream = null;
  let handsModel = null;
  let isModelReady = false;

  // VFX Renderer
  const vfxRenderer = new MagicRenderer();

  // Performance telemetry
  let lastTimestamp = performance.now();
  let smoothFps = 60.0;
  let inwardPoseUntil = 0.0;

  // Apply Character Theme
  function applyHeroTheme(key) {
    const hero = CHARACTERS[key];
    if (!hero) return;

    currentHeroKey = key;
    document.documentElement.style.setProperty("--hero-color", hero.color);
    document.documentElement.style.setProperty("--hero-accent", hero.accent);
    document.documentElement.style.setProperty("--hero-glow", hero.glow);

    heroNameEl.textContent = hero.name;

    charButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.char === key);
    });
  }

  // Responsive Canvas Sizing
  function resizeCanvas() {
    const width = videoElement.videoWidth || window.innerWidth;
    const height = videoElement.videoHeight || window.innerHeight;

    if (canvasElement.width !== width || canvasElement.height !== height) {
      canvasElement.width = width;
      canvasElement.height = height;
    }
  }

  // Initialize MediaPipe Vision Hands
  function initMediaPipe() {
    try {
      handsModel = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      handsModel.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.55,
        minTrackingConfidence: 0.50
      });

      handsModel.onResults(onHandResults);
      isModelReady = true;

      loadingTitle.textContent = "MYSTIC VISION READY";
      loadingDesc.textContent = "Tap Activate Camera to channel live palm magic.";
      btnStartCamera.classList.remove("hidden");
    } catch (err) {
      console.error("MediaPipe initialization error:", err);
      loadingTitle.textContent = "VISION INITIALIZATION FAILED";
      loadingDesc.textContent = "Check network connection to load MediaPipe AI models.";
    }
  }

  // Start Webcam Stream
  async function startWebcam() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }

    try {
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const constraints = {
        video: {
          facingMode: "user",
          width: { ideal: isMobile ? 720 : 1280 },
          height: { ideal: isMobile ? 1280 : 720 }
        },
        audio: false
      };

      cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      videoElement.srcObject = cameraStream;
      await videoElement.play();

      resizeCanvas();
      loadingScreen.classList.add("hidden");

      processVideoFrame();
    } catch (err) {
      console.error("Camera access error:", err);
      loadingTitle.textContent = "CAMERA ACCESS REQUIRED";
      loadingDesc.textContent = "Please grant camera permission in your browser settings to continue.";
    }
  }

  // Frame Processing Loop
  async function processVideoFrame() {
    if (videoElement.readyState >= 2 && isModelReady) {
      await handsModel.send({ image: videoElement });
    }
    requestAnimationFrame(processVideoFrame);
  }

  // MediaPipe Results Callback
  function onHandResults(results) {
    const now = performance.now() / 1000.0;
    const dt = Math.max(now - lastTimestamp, 1e-4);
    lastTimestamp = now;

    const currentFps = 1.0 / dt;
    smoothFps = 0.9 * smoothFps + 0.1 * currentFps;
    statFpsEl.textContent = Math.round(smoothFps);

    const w = canvasElement.width;
    const h = canvasElement.height;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // 1. Draw video background (Mirrored)
    if (isMirrored) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(results.image, 0, 0, w, h);
    ctx.restore();

    // 2. Parse hand points
    const rawHands = results.multiHandLandmarks || [];
    statHandsEl.textContent = rawHands.length;

    const hands = rawHands.map((landmarks) => {
      const points = landmarks.map((pt) => ({
        x: isMirrored ? 1.0 - pt.x : pt.x,
        y: pt.y,
        z: pt.z || 0
      }));
      return { points };
    });

    const hero = CHARACTERS[currentHeroKey];
    let activePose = "READY";

    if (hands.length >= 2) {
      const inwardDetected = facingEachOther(hands[0], hands[1]);
      if (inwardDetected) {
        inwardPoseUntil = now + 0.22;
      }
      const inwardPose = now < inwardPoseUntil;
      const cameraPose = palmsFaceCamera(hands[0], hands[1]);

      if (inwardPose) {
        activePose = "CONVERGE";
        vfxRenderer.renderTwoHandField(ctx, hero, hands, now, w, h);
      } else {
        hands.forEach((hand, id) => {
          vfxRenderer.renderHand(ctx, hero, hand, now, id, w, h);
        });

        if (cameraPose) {
          activePose = "BLAST";
          vfxRenderer.renderTwoHandField(ctx, hero, hands, now, w, h);
        }
      }
    } else if (hands.length === 1) {
      activePose = "CHANNELING";
      vfxRenderer.renderHand(ctx, hero, hands[0], now, 0, w, h);
    }

    statPoseEl.textContent = activePose;
  }

  // ==========================================================================
  // Interactions & Controls
  // ==========================================================================
  btnStartCamera.addEventListener("click", startWebcam);

  // Character selection
  charButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      applyHeroTheme(btn.dataset.char);
    });
  });

  // Snapshot capture
  btnSnapshot.addEventListener("click", () => {
    const link = document.createElement("a");
    link.download = `mystic-${CHARACTERS[currentHeroKey].name.toLowerCase()}-${Date.now()}.png`;
    link.href = canvasElement.toDataURL("image/png");
    link.click();
  });

  // Help modal
  btnHelp.addEventListener("click", () => {
    modalHelp.classList.remove("hidden");
  });
  modalClose.addEventListener("click", () => {
    modalHelp.classList.add("hidden");
  });
  modalHelp.addEventListener("click", (e) => {
    if (e.target === modalHelp) modalHelp.classList.add("hidden");
  });

  // Keyboard Shortcuts
  window.addEventListener("keydown", (e) => {
    const key = e.key;
    if (key >= "1" && key <= "5") {
      applyHeroTheme(key);
    } else if (key.toLowerCase() === "h") {
      modalHelp.classList.toggle("hidden");
    } else if (key === " " || key === "Spacebar") {
      e.preventDefault();
      btnSnapshot.click();
    }
  });

  // Responsive adapt on resize / mobile orientation change
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("orientationchange", () => {
    setTimeout(resizeCanvas, 300);
  });

  // Initialize
  applyHeroTheme("1");
  initMediaPipe();
});
