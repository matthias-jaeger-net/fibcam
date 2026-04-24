# cam

> A web app to capture photos with Fibonacci grid overlays and gyroscope guides.

## Live Demo

https://matthias-jaeger-net.github.io/cam/

1. Open in a modern browser (mobile recommended for best experience).
2. Allow camera and gyroscope access when prompted.
3. Use the **shutter button** (bottom centre) to take a photo.
4. Use **toggle buttons** at the top to enable/disable features:
    - Gyroscope level indicator
    - Settings (to save overlays in photos)
    - Camera toggle (front/back)
5. Press the **Fibonacci button** (top-left) to enter Fibonacci grid mode.
6. Click **close** on the captured image to return to camera view.

## Features

- Access front/back camera from the browser
- Full-screen video preview with rule of thirds grid
- **Fibonacci Squares Mode:**
    - Place interactive Fibonacci spiral overlays
    - Edit spirals with intuitive controls (resize, rotate, mirror, delete)
    - Multiple spirals with A, B, C labelling
    - Smooth spiral arc visualization
    - Drag to reposition spirals
- **Gyroscope Support:**
    - Motion-based level indicator
    - Pan camera view based on device tilt
- **Overlay Control:**
    - Toggle Settings button to save overlays in photos
    - Choose whether to capture overlays or just the camera image
- Flash animation for capture feedback
- Preview captured images in overlay
- Download or share captured photos (device permitting)
- Switch between front and back cameras
- SVG icons for all controls

---

## Development notes:

- [x] Add icons and improve toolbar layout
- [x] Implement Fibonacci mode with full controls
- [x] Add gyroscope support
- [x] Toggle overlay saving in photos
- [ ] Add settings menu for advanced options
