// Overlay renderer script
// Phase 2: indicator display and mode change listener
// Phase 3: selection UI built on top of this

const indicator = document.getElementById('claw-indicator');

if (indicator) {
  // Click indicator to request selection mode activation (Phase 3 implements behavior)
  indicator.addEventListener('click', () => {
    if (window.claw?.activateSelection) {
      window.claw.activateSelection();
    }
  });
}

// Listen for overlay mode changes from main process
if (window.claw?.onModeChange) {
  window.claw.onModeChange((mode) => {
    // Phase 3: toggle selection UI visibility based on mode
    // Phase 2: just log for debugging
    console.debug('[claw-overlay] mode:', mode);
  });
}
