(() => {
  const LiquidGlassContainer = typeof Container === "function" ? Container : null;
  const initializeFrame = () => {
    const target = document.querySelector("#about .section-heading");
    if (!target || !LiquidGlassContainer || !window.html2canvas || target.dataset.glassInitialized) return;
    target.dataset.glassInitialized = "true";
    try {
      const frame = new LiquidGlassContainer({ borderRadius: 28, type: "rounded", tintOpacity: 0.12 });
      frame.element.classList.add("liquid-glass-frame");
      frame.element.style.display = "block";
      frame.element.style.padding = "0";
      frame.element.style.width = "min(100%, 820px)";
      frame.element.style.zIndex = "1";
      frame.canvas.style.zIndex = "0";
      frame.canvas.style.pointerEvents = "none";
      target.before(frame.element);
      frame.element.append(target);
      target.classList.add("liquid-glass-frame-content");
      target.style.background = "transparent";
      target.style.borderColor = "transparent";
      target.style.boxShadow = "none";
      requestAnimationFrame(() => frame.updateSizeFromDOM());
    } catch (error) {
      delete target.dataset.glassInitialized;
      console.error("Liquid glass frame could not be initialized", error);
    }
  };

  if (window.flowStudioReady) initializeFrame();
  else window.addEventListener("flow-studio:ready", initializeFrame, { once: true });
})();
