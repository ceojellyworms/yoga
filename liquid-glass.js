(() => {
  function applyLiquidGlass(root = document) {
    if (typeof Button === "undefined" || typeof html2canvas === "undefined") return;

    root.querySelectorAll("button.primary-button, button.glass-button").forEach((nativeButton) => {
      if (nativeButton.dataset.liquidGlass === "true") return;
      if (nativeButton.disabled) return;

      nativeButton.dataset.liquidGlass = "true";
      nativeButton.classList.add("liquid-glass-native");

      const text = nativeButton.textContent.trim();
      const glassButton = new Button({
        text,
        size: 14,
        type: "pill",
        tintOpacity: 0.24,
        warp: false,
        onClick: () => nativeButton.click(),
      });

      glassButton.element.classList.add("liquid-glass-button");
      glassButton.element.setAttribute("aria-label", nativeButton.getAttribute("aria-label") || text);
      nativeButton.before(glassButton.element);
    });
  }

  window.applyLiquidGlass = applyLiquidGlass;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => applyLiquidGlass());
  } else {
    applyLiquidGlass();
  }

  const observer = new MutationObserver(() => applyLiquidGlass());
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
