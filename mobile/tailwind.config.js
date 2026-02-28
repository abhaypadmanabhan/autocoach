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
        navy: '#0A0E1A',
        card: 'rgba(255,255,255,0.04)',
        border: 'rgba(255,255,255,0.08)',
        coral: '#FF6B6B',
        indigo: {
          DEFAULT: '#6366F1',
          500: '#6366F1',
          600: '#4F46E5',
        },
        gold: '#F59E0B',
        textPrimary: '#F1F5F9',
        textMuted: '#64748B',
        success: '#10B981',
        error: '#EF4444',
      },
      fontFamily: {
        sans: ['System'],
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
