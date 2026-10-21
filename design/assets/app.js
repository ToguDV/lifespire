/* ============================================================
   LifeSpire · The Quiet Ascent
   Visual prototype only: screen routing, theme, node variants.
   No game state, no persistence, no real actions.
   ============================================================ */

(function () {
  "use strict";

  var root = document.documentElement;
  var body = document.body;
  var viewport = document.getElementById("viewport");
  var screens = Array.prototype.slice.call(document.querySelectorAll(".screen"));
  var navLinks = Array.prototype.slice.call(document.querySelectorAll("[data-nav]"));
  var themeButtons = Array.prototype.slice.call(document.querySelectorAll(".js-theme"));
  var metaTheme = document.querySelector('meta[name="theme-color"]');

  var VALID = ["map", "camp", "aims", "reliquary", "node", "summary", "welcome"];
  var activeNode = "task";

  /* Theme ---------------------------------------------------- */

  function systemTheme() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function applyTheme(theme, persist) {
    root.dataset.theme = theme;
    if (persist) {
      try {
        localStorage.setItem("lifespire-theme", theme);
      } catch (e) {}
    }
    if (metaTheme) {
      metaTheme.setAttribute("content", theme === "dark" ? "#131511" : "#f1f0ea");
    }
    themeButtons.forEach(function (button) {
      var next = theme === "dark" ? "day" : "night";
      button.setAttribute("aria-checked", theme === "dark" ? "true" : "false");
      button.setAttribute("title", "Switch to " + next);
    });
  }

  function currentTheme() {
    return root.dataset.theme === "dark" || root.dataset.theme === "light"
      ? root.dataset.theme
      : systemTheme();
  }

  applyTheme(currentTheme(), false);

  themeButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      applyTheme(currentTheme() === "dark" ? "light" : "dark", true);
    });
  });

  /* Node detail ---------------------------------------------- */

  var NODES = {
    task: {
      type: "Task node · Medium effort",
      title: "Ride before dawn",
      flavor:
        "The road is quiet before the sun. Take the north trail while the air is still cool.",
      goal: "Wayfarer",
      weeklyChip: "+1 weekly",
      effort: "Medium",
      effortNote: "2 of 3 · 20 minutes",
      xp: "+15",
      gold: "+15 gold",
      aimValue: "+1",
      aimNote: "Wayfarer this week",
      aimName: "Wayfarer",
      aimCount: "2 of 5 this week",
      note: "Rewards land the moment you mark the step complete.",
      primary: "Mark complete",
      secondary: "Skip this step",
      icon: "#i-scroll",
      primaryIcon: "#i-check",
    },
    rest: {
      type: "Rest node · No task",
      title: "The Old Shrine",
      flavor:
        "A pause is part of the route. Sit by the old stones and let the day stay light.",
      goal: "Rest",
      weeklyChip: "",
      effort: "None",
      effortNote: "No task required",
      xp: "+5",
      gold: "No gold",
      aimValue: "None",
      aimNote: "No aim progress",
      aimName: "",
      aimCount: "",
      note: "No task is required. The reward is yours when you take the rest.",
      primary: "Take the rest",
      secondary: "Choose another path",
      icon: "#i-campfire",
      primaryIcon: "#i-campfire",
    },
  };

  function setNode(id) {
    if (!NODES[id]) return;
    activeNode = id;
    var data = NODES[id];
    var detail = document.getElementById("node-detail");
    var medallion = document.getElementById("node-medallion-use");
    var primaryIcon = document.getElementById("node-primary-use");

    if (detail) detail.dataset.variant = id;
    if (medallion) medallion.setAttribute("href", data.icon);
    if (primaryIcon) primaryIcon.setAttribute("href", data.primaryIcon);

    document.querySelectorAll("[data-node-text]").forEach(function (el) {
      var key = el.getAttribute("data-node-text");
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        el.textContent = data[key];
      }
    });

    var title = document.getElementById("node-title");
    if (title) document.title = data.title + " · LifeSpire";
  }

  /* Routing -------------------------------------------------- */

  function hashScreen() {
    var value = (location.hash || "").replace(/^#/, "");
    return VALID.indexOf(value) !== -1 ? value : "";
  }

  function tabForScreen(name) {
    if (name === "map" || name === "node" || name === "summary") return "map";
    if (name === "camp") return "camp";
    if (name === "aims") return "aims";
    if (name === "reliquary") return "reliquary";
    return "";
  }

  function showScreen(name) {
    if (VALID.indexOf(name) === -1) name = "map";

    screens.forEach(function (screen) {
      var active = screen.dataset.screen === name;
      screen.hidden = !active;
      if (active) {
        screen.style.animation = "none";
        // Force a fresh entrance animation without keeping the property.
        void screen.offsetWidth;
        screen.style.animation = "";
      }
    });

    body.dataset.screen = name;
    var tab = tabForScreen(name);

    navLinks.forEach(function (link) {
      var isNav = link.classList.contains("side-link") || link.classList.contains("tab");
      if (!isNav) return;
      if (link.dataset.nav === tab) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    if (name === "node") setNode(activeNode);

    if (viewport) viewport.scrollTop = 0;
    if (name !== "node") document.title = "LifeSpire · The Quiet Ascent";
  }

  function go(name) {
    if (VALID.indexOf(name) === -1) return;
    if (location.hash === "#" + name) {
      showScreen(name);
    } else {
      location.hash = name;
    }
  }

  navLinks.forEach(function (link) {
    link.addEventListener("click", function (event) {
      var target = link.getAttribute("data-nav");
      if (!target) return;
      event.preventDefault();
      go(target);
    });
  });

  document.querySelectorAll("[data-node-id]").forEach(function (button) {
    button.addEventListener("click", function () {
      activeNode = button.getAttribute("data-node-id") || "task";
      go("node");
    });
  });

  window.addEventListener("hashchange", function () {
    var name = hashScreen() || "map";
    showScreen(name);
  });

  // Optional deep link for the rest variant: ?node=rest#node
  try {
    var preload = new URLSearchParams(location.search).get("node");
    if (preload === "rest" || preload === "task") activeNode = preload;
  } catch (e) {}

  var initial = hashScreen() || "map";
  showScreen(initial);

  // Small visual state for the effort segmented control (no data saved).
  document.querySelectorAll(".segmented").forEach(function (group) {
    group.addEventListener("click", function (event) {
      var button = event.target.closest("button");
      if (!button) return;
      group.querySelectorAll("button").forEach(function (item) {
        item.setAttribute("aria-pressed", item === button ? "true" : "false");
      });
    });
  });
})();
