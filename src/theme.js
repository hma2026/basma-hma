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
      background: COLORS.card,
      border: "1px solid " + COLORS.cardBorder,
      borderRadius: RADIUS.xl,
      padding: padding,
      boxShadow: SHADOWS.card,
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
