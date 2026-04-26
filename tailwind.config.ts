import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

// Helper for the daisyUI-replacement tokens. Each maps to an
// `rgb(R G B / <alpha-value>)` expression so utilities like
// `bg-success/35`, `text-warning/12` continue to compose correctly
// after daisyUI was removed. The triplet vars are defined in
// src/index.css under both light and night themes.
const rgbVar = (name: string) => `rgb(var(--${name}-rgb) / <alpha-value>)`;

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
				display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
			},
			colors: {
				border: 'var(--border)',
				input: 'var(--input)',
				ring: 'var(--ring)',
				background: 'var(--background)',
				foreground: 'var(--foreground)',
				primary: {
					DEFAULT: 'var(--primary)',
					foreground: 'var(--primary-foreground)'
				},
				secondary: {
					DEFAULT: 'var(--secondary)',
					foreground: 'var(--secondary-foreground)'
				},
				destructive: {
					DEFAULT: 'var(--destructive)',
					foreground: 'var(--destructive-foreground)'
				},
				muted: {
					DEFAULT: 'var(--muted)',
					foreground: 'var(--muted-foreground)'
				},
				accent: {
					DEFAULT: 'var(--accent)',
					foreground: 'var(--accent-foreground)'
				},
				popover: {
					DEFAULT: 'var(--popover)',
					foreground: 'var(--popover-foreground)'
				},
				card: {
					DEFAULT: 'var(--card)',
					foreground: 'var(--card-foreground)'
				},
				sidebar: {
					DEFAULT: 'var(--sidebar-background)',
					foreground: 'var(--sidebar-foreground)',
					primary: 'var(--sidebar-primary)',
					'primary-foreground': 'var(--sidebar-primary-foreground)',
					accent: 'var(--sidebar-accent)',
					'accent-foreground': 'var(--sidebar-accent-foreground)',
					border: 'var(--sidebar-border)',
					ring: 'var(--sidebar-ring)'
				},
				// ─── daisyUI-replacement tokens ─────────────────────
				// daisyUI used to register success/warning/error/info,
				// base-100/200/300/content, neutral, primary-content,
				// etc. Now that the plugin is gone we register them
				// here against the RGB triplet vars in src/index.css so
				// the same `bg-success/35`, `text-base-content`,
				// `border-base-300` classes keep working unchanged.
				success: {
					DEFAULT: rgbVar('success'),
					content: rgbVar('success-content'),
				},
				warning: {
					DEFAULT: rgbVar('warning'),
					content: rgbVar('warning-content'),
				},
				error: {
					DEFAULT: rgbVar('error'),
					content: rgbVar('error-content'),
				},
				info: {
					DEFAULT: rgbVar('info'),
					content: rgbVar('info-content'),
				},
				neutral: {
					DEFAULT: rgbVar('neutral'),
					content: rgbVar('neutral-content'),
				},
				'base-100': rgbVar('base-100'),
				'base-200': rgbVar('base-200'),
				'base-300': rgbVar('base-300'),
				'base-content': rgbVar('base-content'),
				'primary-content': rgbVar('primary-content'),
				'secondary-content': rgbVar('secondary-content'),
				'accent-content': rgbVar('accent-content'),
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out'
			}
		}
	},
	plugins: [
		tailwindcssAnimate,
	],
} satisfies Config;
