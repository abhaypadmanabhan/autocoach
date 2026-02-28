/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        navy: '#100F0D',
        card: '#1C1A17',
        surface: '#252220',
        surfaceHover: '#2D2A26',
        border: 'rgba(255,255,255,0.08)',
        borderStrong: 'rgba(255,255,255,0.14)',
        coral: '#F97316',
        indigo: {
          DEFAULT: '#0D9488',
          500: '#0D9488',
          600: '#0F766E',
        },
        gold: '#FBBF24',
        textPrimary: '#FAF5ED',
        textMuted: '#8A8278',
        textSubtle: '#5C5854',
        success: '#22C55E',
        error: '#EF4444',
        warning: '#F59E0B',
      },
      fontFamily: {
        sans: ['Outfit_400Regular', 'System'],
        'outfit-medium': ['Outfit_500Medium', 'System'],
        'outfit-semibold': ['Outfit_600SemiBold', 'System'],
        'outfit-bold': ['Outfit_700Bold', 'System'],
        'outfit-extrabold': ['Outfit_800ExtraBold', 'System'],
      },
      spacing: {
        4: '4px',
        8: '8px',
        12: '12px',
        16: '16px',
        20: '20px',
        24: '24px',
        32: '32px',
        48: '48px',
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      },
    },
  },
  plugins: [],
};
