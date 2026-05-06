/**
 * Origin UI Design Tokens for Tecnogafas App
 * Premium mobile-first design system
 */

export const tokens = {
	// Spacing scale (8px base unit)
	spacing: {
		0: "0px",
		1: "4px",
		2: "8px",
		3: "12px",
		4: "16px",
		5: "20px",
		6: "24px",
		8: "32px",
		10: "40px",
		12: "48px",
		16: "64px",
		20: "80px",
		24: "96px",
		32: "128px",
	},

	// Border radius
	radius: {
		none: "0px",
		sm: "2px",
		base: "4px",
		md: "6px",
		lg: "8px",
		xl: "12px",
		"2xl": "16px",
		"3xl": "24px",
		"4xl": "32px",
		full: "9999px",
	},

	// Typography scale
	fontSize: {
		xs: ["12px", { lineHeight: "16px" }],
		sm: ["14px", { lineHeight: "20px" }],
		base: ["16px", { lineHeight: "24px" }],
		lg: ["18px", { lineHeight: "28px" }],
		xl: ["20px", { lineHeight: "28px" }],
		"2xl": ["24px", { lineHeight: "32px" }],
		"3xl": ["30px", { lineHeight: "36px" }],
		"4xl": ["36px", { lineHeight: "44px" }],
		"5xl": ["48px", { lineHeight: "56px" }],
		"6xl": ["60px", { lineHeight: "68px" }],
	},

	// Shadows for premium depth
	shadows: {
		sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
		base: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
		md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
		lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
		xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
		"2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
		inner: "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)",
	},

	// Animation durations
	duration: {
		75: "75ms",
		100: "100ms",
		150: "150ms",
		200: "200ms",
		300: "300ms",
		500: "500ms",
		700: "700ms",
		1000: "1000ms",
	},

	// Animation easing
	ease: {
		linear: "linear",
		in: "cubic-bezier(0.4, 0, 1, 1)",
		out: "cubic-bezier(0, 0, 0.2, 1)",
		"in-out": "cubic-bezier(0.4, 0, 0.2, 1)",
		"bounce-in": "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
		"smooth-out": "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
	},

	// Z-index scale
	zIndex: {
		hide: -1,
		auto: "auto",
		base: 0,
		docked: 10,
		dropdown: 1000,
		sticky: 1100,
		banner: 1200,
		overlay: 1300,
		modal: 1400,
		popover: 1500,
		skipLink: 1600,
		toast: 1700,
		tooltip: 1800,
	},
};

export const animations = {
	// Micro-interactions
	scale: {
		hover: "scale(1.02)",
		active: "scale(0.98)",
		tap: "scale(0.95)",
	},

	// Page transitions
	slide: {
		up: { y: [20, 0], opacity: [0, 1] },
		down: { y: [-20, 0], opacity: [0, 1] },
		left: { x: [20, 0], opacity: [0, 1] },
		right: { x: [-20, 0], opacity: [0, 1] },
	},

	// Loading states
	pulse: {
		opacity: [1, 0.5, 1],
	},

	shimmer: {
		backgroundPosition: ["200% 0", "-200% 0"],
	},
};

export const breakpoints = {
	sm: "640px",
	md: "768px",
	lg: "1024px",
	xl: "1280px",
	"2xl": "1536px",
};

// Safe areas for mobile devices
export const safeAreas = {
	top: "env(safe-area-inset-top)",
	right: "env(safe-area-inset-right)",
	bottom: "env(safe-area-inset-bottom)",
	left: "env(safe-area-inset-left)",
};
