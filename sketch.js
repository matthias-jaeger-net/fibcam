let cam;
let facingMode = "environment";

let symetry = false;
let fibMode = false;
let fibSpiralOnPhoto = false;

let dragging = false;
let dragSpiralIdx = -1;
let dragOffsetX = 0;
let dragOffsetY = 0;

let spirals = [];
let activeIdx = -1;
let nextLabelCode = 65;

// ================= DOM =================

const flashEl = document.getElementById("flash");
const shutter = document.getElementById("shutter");
const switchBtn = document.getElementById("switch-camera");

const topBar = document.querySelector(".top-bar");
const bottomBar = document.querySelector(".bottom-bar");

const overlay = document.getElementById("photo-overlay");
const overlayImage = document.getElementById("overlay-image");
const download = document.getElementById("download");
const closeBtn = document.getElementById("close");

const fibMessage = document.getElementById("fib-message");
const fibControls = document.getElementById("fib-controls-bar");
const fibList = document.getElementById("fib-list-bar");
const fibShutter = document.getElementById("fib-shutter");

// ================= UI HELPERS =================

function hideFibUI() {
    [fibControls, fibList, fibShutter, fibMessage].forEach((el) => {
        if (el) el.style.display = "none";
    });
    bottomBar.style.display = "";
}

function restoreFibUI() {
    fibControls.style.display = "flex";
    fibShutter.style.display = "block";
    fibMessage.style.display = "none";
    bottomBar.style.display = "none";

    if (spirals.length > 1) fibList.style.display = "flex";
}

closeBtn.onclick = () => {
    overlay.classList.remove("active");
    if (fibMode) restoreFibUI();
};

// ================= FIBONACCI CORE =================

// Fibonacci sequence generator
function fibSeq(n) {
    const seq = [1, 1];
    while (seq.length < n) {
        seq.push(seq[seq.length - 1] + seq[seq.length - 2]);
    }
    return seq;
}

// Build squares from Fibonacci sequence
function buildFibSquares(sp) {
    const setup = sp.setup;
    if (!setup) return [];

    const seq = fibSeq(setup.count);
    const dirs = [
        { dx: 0, dy: -1 },
        { dx: 1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
    ];

    let x = setup.anchorX;
    let y = setup.anchorY;
    let dir = setup.sq2DirIndex;

    const squares = [];

    for (let i = 0; i < seq.length; i++) {
        const size = seq[i] * sp.baseSize;

        squares.push({ x, y, size });

        const d = dirs[dir];
        x += d.dx * size;
        y += d.dy * size;

        dir = (dir + 1) % 4;
    }

    return squares;
}

// Recenter + fit to screen
function fitSpiral(sp) {
    if (!sp.setup) return;

    const squares = buildFibSquares(sp);

    let minX = Infinity,
        minY = Infinity;
    let maxX = -Infinity,
        maxY = -Infinity;

    for (const s of squares) {
        const h = s.size / 2;
        minX = Math.min(minX, s.x - h);
        minY = Math.min(minY, s.y - h);
        maxX = Math.max(maxX, s.x + h);
        maxY = Math.max(maxY, s.y + h);
    }

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const scale =
        Math.min(width / (maxX - minX), height / (maxY - minY)) * 0.85;

    sp.setup.anchorX += width / 2 - cx;
    sp.setup.anchorY += height / 2 - cy;

    sp.baseSize *= scale;

    sp.squares = buildFibSquares(sp);
}

// ================= SPIRAL CONTROL =================

function createDefaultSpiral() {
    const W = window.innerWidth;
    const H = window.innerHeight;

    const sp = {
        setup: {
            anchorX: W / 2,
            anchorY: H / 2,
            sq2DirIndex: 1,
            count: 3, // 🔥 ALWAYS 3 START
        },
        baseSize: Math.min(W, H) * 0.05,
        squares: [],
        mirrored: false,
        label: String.fromCharCode(nextLabelCode++),
    };

    sp.squares = buildFibSquares(sp);
    fitSpiral(sp);

    return sp;
}

function focusOnSpiral(sp) {
    if (!sp?.squares?.length) return;
    setFocusPoint(sp.squares[0].x, sp.squares[0].y);
}

// ================= UI LIST =================

function updateFibList() {
    fibList.innerHTML = "";

    spirals.forEach((sp, i) => {
        const btn = document.createElement("button");
        btn.textContent = sp.label;
        btn.style.opacity = i === activeIdx ? "1" : "0.4";

        btn.onclick = () => {
            activeIdx = i;
            updateFibList();
        };

        fibList.appendChild(btn);
    });

    fibList.style.display = spirals.length > 1 ? "flex" : "none";
}

// ================= BUTTONS =================

// + ADD CELL
fibControls.querySelector("#fib-plus").onclick = (e) => {
    e.stopPropagation();

    const sp = spirals[activeIdx];
    sp.setup.count += 1;

    sp.squares = buildFibSquares(sp);
    fitSpiral(sp);
};

// − REMOVE CELL
fibControls.querySelector("#fib-minus").onclick = (e) => {
    e.stopPropagation();

    const sp = spirals[activeIdx];
    sp.setup.count = Math.max(3, sp.setup.count - 1);

    sp.squares = buildFibSquares(sp);
    fitSpiral(sp);
};

// ROTATE
fibControls.querySelector("#fib-spin").onclick = (e) => {
    e.stopPropagation();

    const sp = spirals[activeIdx];
    sp.setup.sq2DirIndex = (sp.setup.sq2DirIndex + 1) % 4;

    sp.squares = buildFibSquares(sp);
    fitSpiral(sp);
};

// MIRROR
fibControls.querySelector("#fib-mirror").onclick = (e) => {
    e.stopPropagation();

    const sp = spirals[activeIdx];
    sp.mirrored = !sp.mirrored;
};

// OVERLAY TOGGLE
fibControls.querySelector("#fib-on-photo").onclick = (e) => {
    e.stopPropagation();
    fibSpiralOnPhoto = !fibSpiralOnPhoto;
};

// ================= INIT =================

function setup() {
    const c = createCanvas(window.innerWidth, window.innerHeight);
    c.parent("camera-container");

    cam = createCapture({
        video: { facingMode },
        audio: false,
    });

    cam.hide();

    spirals = [createDefaultSpiral()];
    activeIdx = 0;

    updateFibList();
}

// ================= DRAW =================

function draw() {
    if (!cam) return;

    background(0);

    image(cam, 0, 0, width, height);

    if (fibMode) {
        drawFib();
    }
}

// ================= DRAW FIB =================

function drawFib() {
    stroke(0, 170, 255);
    noFill();
    rectMode(CENTER);

    const sp = spirals[activeIdx];

    const squares = buildFibSquares(sp);

    for (const s of squares) {
        rect(s.x, s.y, s.size, s.size);
    }
}

// ================= PHOTO =================

async function takePhoto() {
    const temp = createGraphics(width, height);
    temp.image(cam, 0, 0, width, height);

    const dataUrl = temp.canvas.toDataURL();

    overlayImage.src = dataUrl;
    overlay.classList.add("active");

    download.href = dataUrl;
}

fibShutter.onclick = takePhoto;
shutter.onclick = takePhoto;

switchBtn.onclick = () => {
    facingMode = facingMode === "environment" ? "user" : "environment";
};
