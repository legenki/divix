window.addEventListener(
  "keydown",
  (event) => {
    if (event.defaultPrevented) return;

    switch (event.code) {
      case "Space":
        startScan();
        event.preventDefault();
        break;
      case "KeyH":
        pane.expanded = !pane.expanded;
        event.preventDefault();
        break;
      case "KeyD":
        saveImage();
        event.preventDefault();
        break;
      case "KeyR":
        resetScan();
        event.preventDefault();
        break;
      case "KeyT":
        resetBaseShiftX();
        resetBaseShiftY();
        resetBaseScaling();
        resetBaseRotation();
        event.preventDefault();
        break;
      case "KeyM":
        event.shiftKey ? resetMask() : changeMode(); // Mask / Reset Mask (M / Shift + M)
        event.preventDefault();
        break;
      case "KeyL":
        layout.mode === "side" ? (layout.mode = "layer") : (layout.mode = "side");
        scanLayoutControl.refresh();
        event.preventDefault();
        break;
      case "KeyL":
        layout.mode === "side" ? (layout.mode = "layer") : (layout.mode = "side");
        scanLayoutControl.refresh();
        event.preventDefault();
        break;
      case "KeyS":
        scan.type === "horizontal" ? (scan.type = "vertical") : (scan.type = "horizontal");
        scanDirectionControl.refresh();
        event.preventDefault();
        break;
    }
  },
  true
);

// window.addEventListener("keydown", function(e) {

// 	// Reset Image Position (P)
// 	if (keyCode === 80) {
// 		maapClear();
// 		resetScale();
// 	}

// 	// Clear Result (C)
// 	if (keyCode === 67) {
// 		gResult.clear();
// 	}

// }, false);
