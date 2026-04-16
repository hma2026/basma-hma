/* ═══════════════════════════════════════════════════════
   BASMA HMA — DESIGN SYSTEM
   ═══════════════════════════════════════════════════════ */

/* ── COLOR TOKENS ── */
export const COLORS = {
  // Backgrounds
  bg1: "#0d2445",          // gradient top
  bg2: "#091a38",          // gradient mid
  bg3: "#071428",          // gradient bottom
  card: "#142537",         // card surface
  cardBorder: "#1f3a55",   // card border
  cardHover: "#1a2e47",    // card hover state

  // Brand
  gold: "#c9a84c",
  goldLight: "#e8d5a3",
  goldDark: "#8b6914",
  goldGradient: "linear-gradient(180deg, #fae7b8 0%, #e8d19a 15%, #c9a84c 45%, #a17e2f 70%, #8b6914 100%)",

  // Metallic surface (for secondary buttons/cards)
  metallic: "linear-gradient(180deg, rgba(255,255,255,.14) 0%, rgba(255,255,255,.05) 50%, rgba(255,255,255,.1) 100%)",
  metallicBorder: "rgba(255,255,255,.18)",

  // Semantic
  success: "#10b981",
  warning: "#d4a017",
  danger: "#E2192C",
  info: "#2b5ea7",

  // Text
  textPrimary: "#e8edf4",      // main text on dark bg
  textSecondary: "#a8b5cc",    // sub text
  textMuted: "#7a8fa8",        // muted labels
  textOnGold: "#1a1200",       // text on gold buttons
  textDanger: "#FF6B6B",

  // Utility
  white: "#ffffff",
  black: "#000000",
  transparent: "transparent",
};

/* ── SPACING SCALE (4pt grid) ── */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

/* ── TYPOGRAPHY ── */
export const TYPOGRAPHY = {
  // Font families
  fontCairo: "'Cairo','Tajawal',sans-serif",
  fontTajawal: "'Tajawal',sans-serif",
  fontSerif: "'Times New Roman',Georgia,serif",

  // Sizes
  h1: { fontSize: 20, fontWeight: 800, lineHeight: 1.3 },
  h2: { fontSize: 16, fontWeight: 800, lineHeight: 1.4 },
  h3: { fontSize: 14, fontWeight: 700, lineHeight: 1.4 },
  body: { fontSize: 13, fontWeight: 500, lineHeight: 1.6 },
  bodySm: { fontSize: 12, fontWeight: 500, lineHeight: 1.5 },
  caption: { fontSize: 11, fontWeight: 600, lineHeight: 1.4 },
  tiny: { fontSize: 9, fontWeight: 600, lineHeight: 1.3 },
};

/* ── RADIUS ── */
export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 16,
  pill: 999,
};

/* ── SHADOWS ── */
export const SHADOWS = {
  card: "0 2px 12px rgba(0,0,0,.25)",
  button: "0 3px 12px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.2)",
  gold: "inset 0 1px 0 rgba(255,255,255,.5), 0 4px 14px rgba(201,168,76,.35)",
};

/* ═══════════════════════════════════════════════════════
   REUSABLE COMPONENTS
   ═══════════════════════════════════════════════════════ */

import React from "react";

/* ── BUTTON ──
   Variants: primary (gold) | secondary (metallic) | danger (red outline)
   Sizes:    md (default, 44px) | lg (52px)
*/
export function Button({ variant = "secondary", size = "md", icon, children, onClick, disabled, fullWidth = true, style = {} }) {
  var base = {
    width: fullWidth ? "100%" : "auto",
    height: size === "lg" ? 52 : 44,
    padding: "0 " + SPACING.lg + "px",
    borderRadius: RADIUS.lg,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    fontFamily: TYPOGRAPHY.fontCairo,
    fontWeight: 800,
    fontSize: size === "lg" ? 15 : 13,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    transition: "transform .15s",
    border: "1px solid",
  };

  var variants = {
    primary: {
      background: COLORS.goldGradient,
      borderColor: COLORS.goldLight,
      color: COLORS.textOnGold,
      boxShadow: SHADOWS.gold,
    },
    secondary: {
      background: COLORS.metallic,
      borderColor: COLORS.metallicBorder,
      color: COLORS.goldLight,
      boxShadow: SHADOWS.button,
    },
    danger: {
      background: "transparent",
      borderColor: COLORS.danger,
      color: COLORS.danger,
      boxShadow: "none",
    },
  };

  return React.createElement("button", {
    onClick: disabled ? undefined : onClick,
    disabled: disabled,
    style: { ...base, ...variants[variant], ...style },
  },
    icon ? React.createElement("span", { style: { fontSize: 18, display: "flex", alignItems: "center" } }, icon) : null,
    React.createElement("span", null, children)
  );
}

/* ── CARD ── */
export function Card({ children, style = {}, onClick, padding = SPACING.lg }) {
  return React.createElement("div", {
    onClick: onClick,
    style: {
      background: COLORS.metallic,
      border: "1px solid " + COLORS.metallicBorder,
      borderRadius: RADIUS.xl,
      padding: padding,
      boxShadow: SHADOWS.button,
      cursor: onClick ? "pointer" : "default",
      ...style,
    },
  }, children);
}

/* ── SECTION ── (consistent vertical spacing) */
export function Section({ children, spacing = SPACING.md, style = {} }) {
  return React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: spacing,
      ...style,
    },
  }, children);
}

/* ── PAGE HEADER ── */
export function PageHeader({ title, subtitle, right }) {
  return React.createElement("div", {
    style: {
      padding: SPACING.lg + "px " + SPACING.lg + "px 0",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
  },
    React.createElement("div", null,
      React.createElement("div", { style: { ...TYPOGRAPHY.h1, color: COLORS.white, fontFamily: TYPOGRAPHY.fontCairo } }, title),
      subtitle ? React.createElement("div", { style: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: 2 } }, subtitle) : null
    ),
    right
  );
}

/* ═══════════════════════════════════════════════════════
   ICONS (SVG — 20px default, uniform stroke style)
   ═══════════════════════════════════════════════════════ */

function makeIcon(path, viewBox) {
  return function({ size = 20, color = "currentColor" }) {
    return React.createElement("svg", {
      width: size, height: size,
      viewBox: viewBox || "0 0 24 24",
      fill: "none", stroke: color, strokeWidth: 2,
      strokeLinecap: "round", strokeLinejoin: "round",
      style: { display: "block", flexShrink: 0 },
    }, path);
  };
}

export const Icons = {
  sun: makeIcon(React.createElement(React.Fragment, null,
    React.createElement("circle", { cx: 12, cy: 12, r: 4 }),
    React.createElement("path", { d: "M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" })
  )),
  clipboard: makeIcon(React.createElement(React.Fragment, null,
    React.createElement("path", { d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" }),
    React.createElement("rect", { x: 8, y: 2, width: 8, height: 4, rx: 1 })
  )),
  hand: makeIcon(React.createElement(React.Fragment, null,
    React.createElement("path", { d: "M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8" }),
    React.createElement("path", { d: "M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" })
  )),
  building: makeIcon(React.createElement("path", { d: "M3 21h18M3 10l9-7 9 7M5 10v11M19 10v11M9 21v-6h6v6" })),
  message: makeIcon(React.createElement("path", { d: "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" })),
  edit: makeIcon(React.createElement(React.Fragment, null,
    React.createElement("path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }),
    React.createElement("path", { d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" })
  )),
  user: makeIcon(React.createElement(React.Fragment, null,
    React.createElement("path", { d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" }),
    React.createElement("circle", { cx: 12, cy: 7, r: 4 })
  )),
  home: makeIcon(React.createElement(React.Fragment, null,
    React.createElement("path", { d: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" }),
    React.createElement("polyline", { points: "9 22 9 12 15 12 15 22" })
  )),
  medal: makeIcon(React.createElement(React.Fragment, null,
    React.createElement("circle", { cx: 12, cy: 15, r: 6 }),
    React.createElement("path", { d: "M8.5 2l3.5 7 3.5-7M6 9l6 12 6-12" })
  )),
  chart: makeIcon(React.createElement(React.Fragment, null,
    React.createElement("line", { x1: 12, y1: 20, x2: 12, y2: 10 }),
    React.createElement("line", { x1: 18, y1: 20, x2: 18, y2: 4 }),
    React.createElement("line", { x1: 6, y1: 20, x2: 6, y2: 16 })
  )),
  alert: makeIcon(React.createElement(React.Fragment, null,
    React.createElement("path", { d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }),
    React.createElement("line", { x1: 12, y1: 9, x2: 12, y2: 13 }),
    React.createElement("line", { x1: 12, y1: 17, x2: 12.01, y2: 17 })
  )),
  check: makeIcon(React.createElement("polyline", { points: "20 6 9 17 4 12" })),
};
