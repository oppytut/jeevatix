export const jeevatixBrandColors = {
	canvas: '#fffaf2',
	ink: '#0f172a',
	coral: '#e85d3f',
	coralSoft: '#f29b86',
	gold: '#f3b43f',
	teal: '#0f766e',
	tealSoft: '#7dd3c7',
	cloud: '#f8fafc'
} as const;

export const jeevatixBrandTheme = {
	fontFamily: {
		sans: ['Inter Variable', 'ui-sans-serif', 'system-ui', 'sans-serif']
	},
	colors: {
		jeevatix: {
			50: '#fff7ed',
			100: '#ffedd5',
			200: '#fed7aa',
			300: '#fdba74',
			400: '#fb923c',
			500: '#f97316',
			600: '#ea580c',
			700: '#c2410c',
			800: '#9a3412',
			900: '#7c2d12'
		},
		sea: {
			50: '#f0fdfa',
			100: '#ccfbf1',
			200: '#99f6e4',
			300: '#5eead4',
			400: '#2dd4bf',
			500: '#14b8a6',
			600: '#0d9488',
			700: '#0f766e',
			800: '#115e59',
			900: '#134e4a'
		}
	},
	borderRadius: {
		xl: '1rem',
		'2xl': '1.5rem',
		'3xl': '2rem'
	},
	boxShadow: {
		spotlight: '0 24px 80px rgba(15, 23, 42, 0.12)',
		float: '0 16px 48px rgba(232, 93, 63, 0.18)'
	}
} as const;

export const jeevatixTailwindPreset = {
	theme: {
		extend: jeevatixBrandTheme
	}
} as const;