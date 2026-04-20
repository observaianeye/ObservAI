/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand palette — calibrated for the "Neural Interface" dark theme.
        // Usage: bg-brand-500, text-brand-300, border-brand-500/40.
        brand: {
          50:  '#e7f2ff',
          100: '#c9e2ff',
          200: '#9cc9ff',
          300: '#62a8ff',
          400: '#3988ff',
          500: '#1d6bff',
          600: '#1252e0',
          700: '#0d3ead',
          800: '#0a2e80',
          900: '#071e54',
          950: '#040f2e',
        },
        accent: {
          // Cyan complement for live/active states (bboxes, pulses).
          50:  '#e0fbff',
          100: '#b3f2ff',
          200: '#7de6ff',
          300: '#3ad2ff',
          400: '#12bcff',
          500: '#06a1e6',
          600: '#0381bd',
          700: '#036494',
          800: '#02496e',
          900: '#013150',
        },
        violet: {
          // Secondary accent for demographics (female / premium indicators).
          400: '#b56bff',
          500: '#9a4dff',
          600: '#7e2fe6',
        },
        surface: {
          // Layered dark surfaces — 0 is deepest, 4 is topmost.
          0:  '#050813',
          1:  '#080c1c',
          2:  '#0b1226',
          3:  '#111a33',
          4:  '#1a2547',
        },
        ink: {
          // Text ramp over dark surfaces.
          0:  '#ffffff',
          1:  '#e6ebff',
          2:  '#b4bdd6',
          3:  '#7e89a8',
          4:  '#4a5576',
          5:  '#2a3050',
        },
        success: { 400: '#42e7a3', 500: '#1fc98a', 600: '#0fa66e' },
        warning: { 400: '#ffb547', 500: '#f59b24', 600: '#d67b10' },
        danger:  { 400: '#ff6b7a', 500: '#ef4a5c', 600: '#c92d42' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        // Tighter heading scale for editorial hero typography.
        'display-xl': ['clamp(3rem, 6vw, 5.5rem)', { lineHeight: '1.02', letterSpacing: '-0.035em' }],
        'display-lg': ['clamp(2.25rem, 4.5vw, 4rem)', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
        'display-md': ['clamp(1.75rem, 3vw, 2.75rem)', { lineHeight: '1.1', letterSpacing: '-0.025em' }],
      },
      boxShadow: {
        'glow-brand':  '0 0 0 1px rgba(29,107,255,0.25), 0 20px 60px -20px rgba(29,107,255,0.45)',
        'glow-accent': '0 0 0 1px rgba(6,161,230,0.25), 0 20px 60px -20px rgba(6,161,230,0.5)',
        'glow-violet': '0 0 0 1px rgba(154,77,255,0.25), 0 20px 60px -20px rgba(154,77,255,0.45)',
        'elevated':    '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 20px 50px -20px rgba(0,0,0,0.8)',
        'card':        '0 1px 0 0 rgba(255,255,255,0.06) inset, 0 12px 30px -12px rgba(0,0,0,0.6)',
      },
      backgroundImage: {
        'grid-faint':
          "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
        'radial-aurora':
          'radial-gradient(1200px 600px at 10% -20%, rgba(29,107,255,0.25), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(154,77,255,0.18), transparent 55%), radial-gradient(700px 400px at 50% 120%, rgba(6,161,230,0.18), transparent 60%)',
        'hero-sheen':
          'linear-gradient(120deg, rgba(29,107,255,0) 0%, rgba(29,107,255,0.18) 45%, rgba(154,77,255,0.18) 55%, rgba(29,107,255,0) 100%)',
      },
      backgroundSize: {
        'grid-sm': '32px 32px',
        'grid-lg': '64px 64px',
      },
      keyframes: {
        shimmer:   { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        float:     { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        'pulse-soft': { '0%,100%': { opacity: '0.55' }, '50%': { opacity: '1' } },
        'grid-flow': { '0%': { backgroundPosition: '0 0' }, '100%': { backgroundPosition: '64px 64px' } },
        'aurora-drift': { '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' }, '50%': { transform: 'translate3d(-6%, 4%, 0) scale(1.06)' } },
        'scan-line': { '0%': { transform: 'translateY(-100%)' }, '100%': { transform: 'translateY(300%)' } },
        'bbox-pulse': { '0%,100%': { opacity: '0.85', boxShadow: '0 0 0 0 rgba(6,161,230,0.5)' }, '50%': { opacity: '1', boxShadow: '0 0 0 6px rgba(6,161,230,0)' } },
        'fade-up':   { '0%': { opacity: '0', transform: 'translateY(16px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        shimmer:       'shimmer 2.4s linear infinite',
        float:         'float 6s ease-in-out infinite',
        'pulse-soft':  'pulse-soft 2.4s ease-in-out infinite',
        'grid-flow':   'grid-flow 18s linear infinite',
        'aurora-drift':'aurora-drift 18s ease-in-out infinite',
        'scan-line':   'scan-line 3.5s ease-in-out infinite',
        'bbox-pulse':  'bbox-pulse 2s ease-in-out infinite',
        'fade-up':     'fade-up 0.6s ease-out both',
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
};
