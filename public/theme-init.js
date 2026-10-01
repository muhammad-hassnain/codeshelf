// Runs before CSS paints — applies the saved or system theme to avoid a flash.
(function () {
  try {
    var stored = localStorage.getItem("ce-theme"); // "light" | "dark" | "system" | null
    var mode = stored || "system";
    var dark =
      mode === "dark" ||
      (mode !== "light" &&
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();
