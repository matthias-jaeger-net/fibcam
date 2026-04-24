let cam;
let facingMode = "environment";

let symetry = false;
let fibMode = false;
let fibSpiralOnPhoto = false;
let fibDrawMode = 'all'; // 'all', 'spiral', 'squares'
let fibButtonClicked = false;
let dragging = false;
let dragSpiralIdx = -1;
let dragOffsetX = 0;
let dragOffsetY = 0;

let spirals = []; // [{ squares, setup, size, label }]
let activeIdx = -1;
let nextLabelCode = 65; // 65 = 'A'

const flashEl = document.getElementById("flash");
const shutter = document.getElementById("shutter");
const switchBtn = document.getElementById("switch-camera");
const topBar = document.querySelector(".top-bar");
const bottomBar = document.querySelector(".bottom-bar");
const fibBtn = document.getElementById("fibonacci-squares");
const gyroToggle = document.getElementById("gyro-toggle");

const overlay = document.getElementById("photo-overlay");
const overlayImage = document.getElementById("overlay-image");
const download = document.getElementById("download");
const closeBtn = document.getElementById("close");

// Query Fibonacci UI elements from DOM
const fibMessage = document.getElementById("fib-message");
const fibControls = document.getElementById("fib-controls-bar");
const fibList = document.getElementById("fib-list-bar");
const fibShutter = document.getElementById("fib-shutter");

function hideFibUI() {
    [fibControls, fibList, fibShutter, fibMessage].forEach(
        (el) => (el.style.display = "none"),
    );
    bottomBar.style.display = "";
}

function restoreFibUI() {
    fibControls.style.display = "flex";
    if (spirals.length > 1) fibList.style.display = "flex";
    fibShutter.style.display = "block";
    bottomBar.style.display = "none";
}

closeBtn.onclick = () => {
    overlay.classList.remove("active");
    if (fibMode) restoreFibUI();
};

const FIB_DIRS = [
    { dx: 0, dy: -1 }, // 0: UP
    { dx: 1, dy: 0 }, // 1: RIGHT
    { dx: 0, dy: 1 }, // 2: DOWN
    { dx: -1, dy: 0 }, // 3: LEFT
];

function buildFibSquares(sp) {
    const { setup, size } = sp;
    if (!setup) return sp.squares;
    const { anchorX, anchorY, sq2DirIndex, count } = setup;
    const d2 = FIB_DIRS[sq2DirIndex];

    const sq1 = {
        x: anchorX - (d2.dx * size) / 2,
        y: anchorY - (d2.dy * size) / 2,
        size,
    };
    const sq2 = {
        x: anchorX + (d2.dx * size) / 2,
        y: anchorY + (d2.dy * size) / 2,
        size,
    };
    const squares = [sq1, sq2];
    const sizes = [size, size];

    let bbox = {
        x: Math.min(sq1.x, sq2.x) - size / 2,
        y: Math.min(sq1.y, sq2.y) - size / 2,
        w: d2.dx !== 0 ? 2 * size : size,
        h: d2.dy !== 0 ? 2 * size : size,
    };
    let dirIndex = (sq2DirIndex - 1 + 4) % 4;

    for (let i = 2; i < count; i++) {
        const s = sizes[i - 1] + sizes[i - 2];
        const dir = FIB_DIRS[dirIndex];
        let cx, cy;
        if (dir.dx !== 0) {
            cx = dir.dx > 0 ? bbox.x + bbox.w + s / 2 : bbox.x - s / 2;
            cy = bbox.y + bbox.h / 2;
        } else {
            cx = bbox.x + bbox.w / 2;
            cy = dir.dy > 0 ? bbox.y + bbox.h + s / 2 : bbox.y - s / 2;
        }
        squares.push({ x: cx, y: cy, size: s });
        sizes.push(s);
        if (dir.dx > 0) bbox.w += s;
        else if (dir.dx < 0) {
            bbox.x -= s;
            bbox.w += s;
        } else if (dir.dy > 0) bbox.h += s;
        else {
            bbox.y -= s;
            bbox.h += s;
        }
        dirIndex = (dirIndex + 1) % 4;
    }
    return squares;
}

function updateFibList() {
    fibList.innerHTML = "";
    spirals.forEach((sp, i) => {
        const item = document.createElement("button");
        item.textContent = sp.label;
        item.style.opacity = i === activeIdx ? "1" : "0.4";
        item.onclick = (e) => {
            e.stopPropagation();
            fibButtonClicked = true;
            activeIdx = i;
            updateFibList();
        };
        fibList.appendChild(item);
    });
    fibList.style.display = spirals.length > 1 ? "flex" : "none";
}

fibControls.querySelector("#fib-minus").onclick = (e) => {
    e.stopPropagation();
    fibButtonClicked = true;
    const sp = spirals[activeIdx];
    if (!sp.setup || sp.setup.count <= 2) return;
    sp.setup.count--;
    sp.setup.sq2DirIndex = (sp.setup.sq2DirIndex + 1) % 4;
    sp.squares = buildFibSquares(sp);
    fitSpiral(sp);
};
fibControls.querySelector("#fib-plus").onclick = (e) => {
    e.stopPropagation();
    fibButtonClicked = true;
    const sp = spirals[activeIdx];
    if (!sp.setup) return;
    sp.setup.count++;
    sp.setup.sq2DirIndex = (sp.setup.sq2DirIndex + 1) % 4;
    sp.squares = buildFibSquares(sp);
    fitSpiral(sp);
};
fibControls.querySelector("#fib-spin").onclick = (e) => {
    e.stopPropagation();
    fibButtonClicked = true;
    const sp = spirals[activeIdx];
    if (sp.setup) {
        sp.setup.sq2DirIndex = (sp.setup.sq2DirIndex + 2) % 4;
        sp.squares = buildFibSquares(sp);
        fitSpiral(sp);
    }
};

fibControls.querySelector("#fib-mirror").onclick = (e) => {
    e.stopPropagation();
    fibButtonClicked = true;
    const sp = spirals[activeIdx];
    if (sp.setup) {
        sp.mirrored = !sp.mirrored;
        sp.squares = buildFibSquares(sp);
        fitSpiral(sp);
    }
};

function centerSpiral(sp) {
    if (!sp.setup || sp.squares.length < 2) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const sq of sp.squares) {
        const s = sq.size / 2;
        minX = Math.min(minX, sq.x - s);
        minY = Math.min(minY, sq.y - s);
        maxX = Math.max(maxX, sq.x + s);
        maxY = Math.max(maxY, sq.y + s);
    }
    const bboxCX = (minX + maxX) / 2;
    const bboxCY = (minY + maxY) / 2;
    sp.setup.anchorX += window.innerWidth / 2 - bboxCX;
    sp.setup.anchorY += window.innerHeight / 2 - bboxCY;
    sp.squares = buildFibSquares(sp);
    focusOnSpiral(sp);
}

function fitSpiral(sp) {
    if (!sp.setup || sp.squares.length < 2) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const sq of sp.squares) {
        const s = sq.size / 2;
        minX = Math.min(minX, sq.x - s);
        minY = Math.min(minY, sq.y - s);
        maxX = Math.max(maxX, sq.x + s);
        maxY = Math.max(maxY, sq.y + s);
    }
    const scale = Math.min(
        window.innerWidth / (maxX - minX),
        window.innerHeight / (maxY - minY),
    );
    const bboxCX = (minX + maxX) / 2;
    const bboxCY = (minY + maxY) / 2;
    const xSign = sp.mirrored ? -1 : 1;
    sp.setup.anchorX = window.innerWidth / 2 + xSign * (sp.setup.anchorX - bboxCX) * scale;
    sp.setup.anchorY = window.innerHeight / 2 + (sp.setup.anchorY - bboxCY) * scale;
    sp.size = sp.size * scale;
    sp.squares = buildFibSquares(sp);
    focusOnSpiral(sp);
}

fibControls.querySelector("#fib-fit").onclick = (e) => {
    e.stopPropagation();
    fibButtonClicked = true;
    fitSpiral(spirals[activeIdx]);
};

fibControls.querySelector("#fib-on-photo").onclick = (e) => {
    e.stopPropagation(); fibButtonClicked = true;
    fibSpiralOnPhoto = !fibSpiralOnPhoto;
    e.currentTarget.classList.toggle("active", fibSpiralOnPhoto);
    const modeGroup = document.getElementById("fib-overlay-mode");
    modeGroup.style.display = fibSpiralOnPhoto ? "flex" : "none";
    if (!fibSpiralOnPhoto) {
        fibDrawMode = 'all';
        modeGroup.querySelectorAll(".fib-mode-btn").forEach(b => b.classList.toggle("active", b.dataset.mode === 'all'));
    }
};

document.querySelectorAll(".fib-mode-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        fibButtonClicked = true;
        fibDrawMode = btn.dataset.mode;
        document.querySelectorAll(".fib-mode-btn").forEach(b => b.classList.toggle("active", b === btn));
    });
});

const settingsBtn = document.getElementById("settings");

function createDefaultSpiral() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    // 9-square spiral bounding box is 34s wide × 55s tall (sq2DirIndex=1)
    const s = Math.min(W / 34, H / 55) * 0.9;
    const setup = { anchorX: W / 2, anchorY: H / 2, sq2DirIndex: 1, count: 9 };
    const sp = { squares: [], setup, size: s, mirrored: false, label: String.fromCharCode(nextLabelCode++) };
    sp.squares = buildFibSquares(sp);

    // Centre the bbox on screen
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const sq of sp.squares) {
        const hs = sq.size / 2;
        minX = Math.min(minX, sq.x - hs); minY = Math.min(minY, sq.y - hs);
        maxX = Math.max(maxX, sq.x + hs); maxY = Math.max(maxY, sq.y + hs);
    }
    sp.setup.anchorX += W / 2 - (minX + maxX) / 2;
    sp.setup.anchorY += H / 2 - (minY + maxY) / 2;
    sp.squares = buildFibSquares(sp);
    return sp;
}

function focusOnSpiral(sp) {
    if (!sp || sp.squares.length === 0) return;
    setFocusPoint(sp.squares[0].x, sp.squares[0].y);
}

fibBtn.onclick = () => {
    fibMode = !fibMode;
    fibBtn.classList.toggle("active", fibMode);

    if (fibMode) {
        nextLabelCode = 65;
        spirals = [createDefaultSpiral()];
        activeIdx = 0;
        topBar.style.display = "none";
        switchBtn.style.display = "none";
        settingsBtn.style.display = "none";
        fibControls.style.display = "flex";
        fibShutter.style.display = "block";
        shutter.style.display = "none";
        updateFibList();
        fitSpiral(spirals[0]);
    } else {
        hideFibUI();
        spirals = [];
        activeIdx = -1;
        fibSpiralOnPhoto = false;
        fibControls.querySelector("#fib-on-photo").classList.remove("active");
        switchBtn.style.display = "";
        settingsBtn.style.display = "";
        shutter.style.display = "";
    }
};

// Motion/tilt variables (from accelerometer gravity vector)
let gyroEnabled = false;
let accelX = 0; // left/right tilt (+right, -left)
let accelY = -9.8; // up/down (upright ≈ -9.8)
let accelZ = 0; // forward/back tilt
let hasGyro = false;

// Check if device requires explicit motion permission (iOS 13+)
function checkGyroSupport() {
    return (
        typeof DeviceMotionEvent !== "undefined" &&
        typeof DeviceMotionEvent.requestPermission === "function"
    );
}

// Auto-request motion permission on app load
async function requestGyroPermission() {
    if (checkGyroSupport()) {
        try {
            const permission = await DeviceMotionEvent.requestPermission();
            if (permission === "granted") {
                hasGyro = true;
                console.log("Motion permission granted automatically");
            }
        } catch (error) {
            console.log("Motion permission not available");
        }
    } else {
        // Non-iOS or older devices - assume support
        hasGyro = true;
        console.log("Motion assumed available");
    }
}

// Gyroscope toggle
if (gyroToggle) {
    gyroToggle.onclick = async () => {
        if (!hasGyro) {
            // Request permission first (must be in response to user tap)
            if (checkGyroSupport()) {
                try {
                    const permission =
                        await DeviceMotionEvent.requestPermission();
                    if (permission === "granted") {
                        hasGyro = true;
                        console.log("Gyroscope permission granted");
                        // Now enable gyro after permission
                        gyroEnabled = true;
                        gyroToggle.classList.toggle("active", true);
                    }
                } catch (error) {
                    console.log("Gyroscope permission denied");
                }
            } else {
                // Non-iOS or older devices - assume support
                hasGyro = true;
                gyroEnabled = true;
                gyroToggle.classList.toggle("active", true);
            }
        } else {
            // Already have permission, just toggle
            gyroEnabled = !gyroEnabled;
            gyroToggle.classList.toggle("active", gyroEnabled);
            console.log("Gyroscope toggled:", gyroEnabled);
        }
    };
}

// Listen for accelerometer gravity vector
window.addEventListener("devicemotion", (event) => {
    const g = event.accelerationIncludingGravity;
    if (g) {
        accelX = g.x || 0;
        accelY = g.y || 0;
        accelZ = g.z || 0;
    }
});

function initCamera() {
    if (cam) cam.remove();

    cam = createCapture({
        video: { facingMode },
        audio: false,
    });

    cam.elt.setAttribute("playsinline", true); // iOS fix
    cam.elt.muted = true;
    cam.hide();
}

async function setFocusPoint(x, y) {
    // x, y are canvas pixel coordinates
    const track =
        cam && cam.elt.srcObject && cam.elt.srcObject.getVideoTracks()[0];
    if (!track) return;

    const capabilities = track.getCapabilities();
    if (!capabilities.focusMode || !capabilities.pointOfInterest) return;

    // Normalise canvas coords to 0-1, then flip for back camera
    const nx = x / width;
    const ny = y / height;

    try {
        await track.applyConstraints({
            advanced: [
                {
                    focusMode: "manual",
                    pointOfInterest: { x: nx, y: ny },
                },
            ],
        });
    } catch (e) {
        console.log("Focus point not supported:", e);
    }
}

function setup() {
    const c = createCanvas(window.innerWidth, window.innerHeight);
    c.parent("camera-container");
    initCamera();
}

function draw() {
    if (!cam || cam.width === 0) return;

    background(0);

    let canvasRatio = width / height;
    let videoRatio = cam.width / cam.height;

    let w, h;

    if (canvasRatio > videoRatio) {
        w = width;
        h = width / videoRatio;
    } else {
        h = height;
        w = height * videoRatio;
    }

    push();

    if (facingMode === "user") {
        translate(width, 0);
        scale(-1, 1);
    }

    let imgX = width / 2 - w / 2;
    let imgY = height / 2 - h / 2;

    // Apply pan effect based on gravity vector
    if (gyroEnabled && hasGyro) {
        let panX = map(accelX, -9.8, 9.8, -30, 30, true);
        let panY = map(accelZ, -9.8, 9.8, -30, 30, true);
        imgX += panX;
        imgY += panY;
    }

    if (!symetry) {
        image(cam, 0, 0, w, h);
    } else {
        const half = cam.get(0, 0, cam.width / 2, cam.height);

        image(half, 0, 0, w / 2, h);

        push();
        translate(w, 0);
        scale(-1, 1);
        image(half, 0, 0, w / 2, h);
        pop();
    }

    pop();

    // Fibonacci squares
    if (fibMode) {
        noFill();
        strokeWeight(2);
        rectMode(CENTER);
        for (let i = 0; i < spirals.length; i++) {
            const sp = spirals[i];
            const isActive = i === activeIdx;
            stroke(0, 170, 255, isActive ? 255 : 100);
            if (sp.squares.length === 0 && isActive) {
                rect(width / 2, height / 2, sp.size, sp.size);
            } else {
                const useMirror = sp.mirrored && sp.setup;
                if (useMirror) {
                    push();
                    translate(2 * sp.setup.anchorX, 0);
                    scale(-1, 1);
                }
                const showSquares = !fibSpiralOnPhoto || fibDrawMode !== 'spiral';
                const showSpiral = !fibSpiralOnPhoto || fibDrawMode !== 'squares';
                if (showSquares) {
                    for (const sq of sp.squares) {
                        rect(sq.x, sq.y, sq.size || sp.size, sq.size || sp.size);
                    }
                }
                if (showSpiral && sp.squares.length >= 3) drawFibSpiral(sp);
                if (useMirror) pop();
            }
        }
        rectMode(CORNER);
    }

    // Rule of thirds guide lines
    stroke(255, 50);
    strokeWeight(1);
    line(width / 3, 0, width / 3, height);
    line((2 * width) / 3, 0, (2 * width) / 3, height);
    line(0, height / 3, width, height / 3);
    line(0, (2 * height) / 3, width, (2 * height) / 3);

    // Draw gyroscope level indicator
    if (gyroEnabled && hasGyro) {
        drawLevelIndicator();
    }
}

function drawLevelIndicator() {
    let centerX = width / 2;
    let centerY = height / 2;
    let lineLength = 100;

    // Derive roll angle from gravity vector (left/right tilt)
    // atan2(x, -y): 0° = upright, positive = tilted right
    let rollAngle = atan2(accelX, -accelY);

    // Blue vertical line rotating with physical roll angle
    push();
    translate(centerX, centerY);
    rotate(rollAngle);
    stroke(0, 120, 255);
    strokeWeight(3);
    line(0, -lineLength, 0, lineLength);
    pop();

    // Numeric tilt value (left side, vertically centred)
    push();
    textSize(14);
    textFont("monospace");
    noStroke();
    fill(0, 120, 255);
    let tiltDeg = degrees(rollAngle);
    text(`tilt ${nf(tiltDeg, 1, 1)}°`, 12, height / 2);
    pop();
}

function drawOverlays(ctx, w, h, imgX, imgY, canvasW, canvasH) {
    // Draw rule of thirds guide lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(canvasW / 3, 0);
    ctx.lineTo(canvasW / 3, canvasH);
    ctx.moveTo((2 * canvasW) / 3, 0);
    ctx.lineTo((2 * canvasW) / 3, canvasH);
    ctx.moveTo(0, canvasH / 3);
    ctx.lineTo(canvasW, canvasH / 3);
    ctx.moveTo(0, (2 * canvasH) / 3);
    ctx.lineTo(canvasW, (2 * canvasH) / 3);
    ctx.stroke();

    // Draw fibonacci squares
    if (fibMode) {
        ctx.fillStyle = "rgba(0, 0, 0, 0)";
        ctx.strokeStyle = "rgba(0, 170, 255, 0.6)";
        ctx.lineWidth = 2;
        for (let i = 0; i < spirals.length; i++) {
            const sp = spirals[i];
            const isActive = i === activeIdx;
            ctx.strokeStyle = isActive
                ? "rgba(0, 170, 255, 1)"
                : "rgba(0, 170, 255, 0.4)";
            if (sp.squares.length === 0 && isActive) {
                ctx.strokeRect(
                    canvasW / 2 - sp.size / 2,
                    canvasH / 2 - sp.size / 2,
                    sp.size,
                    sp.size,
                );
            } else {
                for (const sq of sp.squares) {
                    ctx.strokeRect(
                        sq.x - (sq.size || sp.size) / 2,
                        sq.y - (sq.size || sp.size) / 2,
                        sq.size || sp.size,
                        sq.size || sp.size,
                    );
                }
            }
        }
    }

    // Draw gyroscope level indicator
    if (gyroEnabled && hasGyro) {
        const centerX = canvasW / 2;
        const centerY = canvasH / 2;
        const radius = 40;

        // Draw circle
        ctx.strokeStyle = "rgba(0, 120, 255, 0.8)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Draw horizontal line
        ctx.strokeStyle = "rgba(0, 120, 255, 0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerX - radius, centerY);
        ctx.lineTo(centerX + radius, centerY);
        ctx.stroke();

        // Draw vertical line
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - radius);
        ctx.lineTo(centerX, centerY + radius);
        ctx.stroke();

        // Draw tilt indicator
        const rollAngle = atan2(accelX, accelY);
        const tiltX = centerX + radius * 0.6 * sin(rollAngle);
        const tiltY = centerY + radius * 0.6 * cos(rollAngle);
        ctx.fillStyle = "rgba(0, 170, 255, 0.8)";
        ctx.beginPath();
        ctx.arc(tiltX, tiltY, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawFibSpiral(sp) {
    const { sq2DirIndex } = sp.setup;
    const arcDef = [
        { dx: 0.5, dy: 0.5, a1: PI, a2: PI * 1.5 }, // 0 UP
        { dx: -0.5, dy: 0.5, a1: PI * 1.5, a2: TWO_PI }, // 1 RIGHT
        { dx: -0.5, dy: -0.5, a1: 0, a2: HALF_PI }, // 2 DOWN
        { dx: 0.5, dy: -0.5, a1: HALF_PI, a2: PI }, // 3 LEFT
    ];
    const dirs = [(sq2DirIndex + 2) % 4, (sq2DirIndex + 1) % 4];
    let d = (sq2DirIndex - 1 + 4) % 4;
    for (let i = 2; i < sp.squares.length; i++) {
        dirs.push(d);
        d = (d + 1) % 4;
    }
    noFill();
    for (let i = 0; i < sp.squares.length; i++) {
        const sq = sp.squares[i];
        const s = sq.size;
        const { dx, dy, a1, a2 } = arcDef[dirs[i]];
        arc(sq.x + dx * s, sq.y + dy * s, 2 * s, 2 * s, a1, a2);
    }
}

function mouseDragged() {
    if (dragging && dragSpiralIdx >= 0) {
        const sp = spirals[dragSpiralIdx];
        sp.setup.anchorX = mouseX - dragOffsetX;
        sp.setup.anchorY = mouseY - dragOffsetY;
        sp.squares = buildFibSquares(sp);
    }
}

function mouseReleased() {
    if (dragging && dragSpiralIdx >= 0) {
        focusOnSpiral(spirals[dragSpiralIdx]);
    }
    dragging = false;
    dragSpiralIdx = -1;
}

function touchStarted() {
    mousePressed();
    return true;
}
function touchMoved() {
    mouseDragged();
    return true;
}
function touchEnded() {
    mouseReleased();
    return true;
}

function windowResized() {
    resizeCanvas(window.innerWidth, window.innerHeight);
}

function insideGrabArea(sp, mx, my) {
    if (!sp.setup || sp.squares.length < 2) return false;
    const testX = sp.mirrored ? 2 * sp.setup.anchorX - mx : mx;
    let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
    for (const sq of sp.squares) {
        const s = sq.size / 2;
        minX = Math.min(minX, sq.x - s);
        minY = Math.min(minY, sq.y - s);
        maxX = Math.max(maxX, sq.x + s);
        maxY = Math.max(maxY, sq.y + s);
    }
    return testX >= minX && testX <= maxX && my >= minY && my <= maxY;
}

function isOverFibUI() {
    return [fibShutter, fibControls, fibList].some((el) => {
        if (window.getComputedStyle(el).display === "none") return false;
        const r = el.getBoundingClientRect();
        return (
            mouseX >= r.left &&
            mouseX <= r.right &&
            mouseY >= r.top &&
            mouseY <= r.bottom
        );
    });
}

function mousePressed() {
    if (fibButtonClicked) {
        fibButtonClicked = false;
        return;
    }
    if (isOverFibUI()) return;
    if (fibMode) {
        for (let i = 0; i < spirals.length; i++) {
            if (insideGrabArea(spirals[i], mouseX, mouseY)) {
                dragging = true;
                dragSpiralIdx = i;
                activeIdx = i;
                dragOffsetX = mouseX - spirals[i].setup.anchorX;
                dragOffsetY = mouseY - spirals[i].setup.anchorY;
                updateFibList();
                return;
            }
        }
    }
    if (fibMode && activeIdx >= 0) {
        const sp = spirals[activeIdx];
        if (sp.squares.length === 0) {
            sp.squares.push({ x: mouseX, y: mouseY, size: sp.size });
            fibControls.style.display = "flex";
            fibMessage.style.display = "none";
            fibShutter.style.display = "block";
            shutter.style.display = "none";
            setFocusPoint(sp.squares[0].x, sp.squares[0].y);
        } else if (sp.squares.length === 1) {
            const first = sp.squares[0];
            const dx = mouseX - first.x;
            const dy = mouseY - first.y;
            let sq2DirIndex;
            if (abs(dx) >= abs(dy)) {
                sq2DirIndex = dx > 0 ? 1 : 3;
            } else {
                sq2DirIndex = dy > 0 ? 2 : 0;
            }
            const d = FIB_DIRS[sq2DirIndex];
            sp.setup = {
                anchorX: first.x + (d.dx * sp.size) / 2,
                anchorY: first.y + (d.dy * sp.size) / 2,
                sq2DirIndex,
                count: 2,
            };
            sp.squares = buildFibSquares(sp);
        } else if (sp.setup) {
            sp.setup.count++;
            sp.squares = buildFibSquares(sp);
        }
    }
}

async function takePhoto() {
    flashEl.style.opacity = 1;
    setTimeout(() => (flashEl.style.opacity = 0), 100);

    // Draw camera image to a temp canvas
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width;
    tempCanvas.height = height;
    const ctx = tempCanvas.getContext("2d");

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);

    const videoEl = cam.elt;
    const canvasRatio = width / height;
    const videoRatio = videoEl.videoWidth / videoEl.videoHeight;
    let w, h;
    if (canvasRatio > videoRatio) {
        w = width;
        h = width / videoRatio;
    } else {
        h = height;
        w = height * videoRatio;
    }
    const x = width / 2 - w / 2;
    const y = height / 2 - h / 2;

    if (facingMode === "user") {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
    }
    ctx.drawImage(videoEl, x, y, w, h);

    // Optionally draw the fibonacci overlay onto the photo
    if (fibMode && fibSpiralOnPhoto) {
        ctx.resetTransform();
        ctx.strokeStyle = "rgba(0, 170, 255, 1)";
        ctx.lineWidth = 2;

        if (fibDrawMode !== 'spiral') {
            for (const sp of spirals) {
                if (!sp.setup || sp.squares.length === 0) continue;
                for (const sq of sp.squares) {
                    const s = sq.size || sp.size;
                    ctx.strokeRect(sq.x - s / 2, sq.y - s / 2, s, s);
                }
            }
        }

        if (fibDrawMode !== 'squares') {
            const arcDef = [
                { dx:  0.5, dy:  0.5, a1: Math.PI,       a2: Math.PI * 1.5 },
                { dx: -0.5, dy:  0.5, a1: Math.PI * 1.5, a2: Math.PI * 2   },
                { dx: -0.5, dy: -0.5, a1: 0,              a2: Math.PI * 0.5 },
                { dx:  0.5, dy: -0.5, a1: Math.PI * 0.5, a2: Math.PI       },
            ];
            ctx.beginPath();
            for (const sp of spirals) {
                if (!sp.setup || sp.squares.length === 0) continue;
                const { sq2DirIndex } = sp.setup;
                const dirs = [(sq2DirIndex + 2) % 4, (sq2DirIndex + 1) % 4];
                let d = (sq2DirIndex - 1 + 4) % 4;
                for (let i = 2; i < sp.squares.length; i++) { dirs.push(d); d = (d + 1) % 4; }
                for (let i = 0; i < sp.squares.length; i++) {
                    const sq = sp.squares[i];
                    const s = sq.size;
                    const { dx, dy, a1, a2 } = arcDef[dirs[i]];
                    const cx = sq.x + dx * s;
                    const cy = sq.y + dy * s;
                    ctx.moveTo(cx + s * Math.cos(a1), cy + s * Math.sin(a1));
                    ctx.arc(cx, cy, s, a1, a2);
                }
            }
            ctx.stroke();
        }
    }

    const dataUrl = tempCanvas.toDataURL("image/png");

    overlayImage.src = dataUrl;
    overlay.classList.add("active");
    if (fibMode) hideFibUI();

    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], "photo.png", { type: "image/png" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({ files: [file] });
        } catch {}
    }

    download.href = dataUrl;
}

shutter.onclick = takePhoto;


switchBtn.onclick = () => {
    facingMode = facingMode === "environment" ? "user" : "environment";
    initCamera();
};

fibShutter.onclick = (e) => {
    e.stopPropagation();
    fibButtonClicked = true;
    takePhoto();
};
