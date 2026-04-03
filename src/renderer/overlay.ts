// Overlay renderer script
// Phase 2: toolbar display and mode change listener
// Phase 3: selection UI built on top of this

const selectBtn = document.getElementById('claw-select-btn');

if (selectBtn) {
  selectBtn.addEventListener('click', () => {
    if (window.claw?.activateSelection) {
      window.claw.activateSelection();
    }
  });
}

// Listen for overlay mode changes from main process
if (window.claw?.onModeChange) {
  window.claw.onModeChange((mode) => {
    // Phase 3: toggle selection UI visibility based on mode
    console.debug('[claw-overlay] mode:', mode);
  });
}
