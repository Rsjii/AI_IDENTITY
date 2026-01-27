/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        'xs': ['12px', { lineHeight: '1.5' }],
        'sm': ['14px', { lineHeight: '1.5' }],
        'base': ['16px', { lineHeight: '1.5' }],
        'lg': ['18px', { lineHeight: '1.5' }],
        'xl': ['20px', { lineHeight: '1.2' }],
        '2xl': ['24px', { lineHeight: '1.2' }],
        '3xl': ['32px', { lineHeight: '1.2' }],
        '4xl': ['48px', { lineHeight: '1.1' }],
      },
      fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },
      lineHeight: {
        tight: '1.1',
        heading: '1.2',
        body: '1.5',
      },
      colors: {
        // Existing HSL-based colors (keep for backward compatibility)
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        
        // NEW: Purple Palette (Direct hex values for new design system)
        // Dark mode backgrounds (Primary - for creators/dashboard)
        'bg-primary': '#0A0A0B',
        'bg-secondary': '#18181B',
        'bg-tertiary': '#27272A',
        'bg-elevated': '#3F3F46',
        
        // Light mode backgrounds (Secondary - for public/chat)
        'bg-primary-light': '#FFFFFF',
        'bg-secondary-light': '#F9FAFB',
        'bg-tertiary-light': '#F3F4F6',
        'bg-elevated-light': '#E5E7EB',
        
        // Purple accent (main brand color)
        'accent-primary': '#8B5CF6',
        'accent-hover': '#A78BFA',
        'accent-primary-light': '#7C3AED', // Deeper purple for light mode
        'accent-hover-light': '#6D28D9',
        
        // Text colors (Dark mode)
        'text-primary': '#FAFAFA',
        'text-secondary': '#A1A1AA',
        'text-tertiary': '#71717A',
        'text-muted': '#52525B',
        
        // Text colors (Light mode)
        'text-primary-light': '#111827',
        'text-secondary-light': '#4B5563',
        'text-tertiary-light': '#6B7280',
        'text-muted-light': '#9CA3AF',
        
        // Semantic colors (same for both modes)
        'success': '#10B981',
        'error': '#EF4444',
        'warning': '#F59E0B',
        'info': '#3B82F6',
        'ai-active': '#8B5CF6',
        
        // Borders
        'border-subtle': '#27272A',
        'border-default': '#3F3F46',
        'border-focus': '#8B5CF6',
        'border-subtle-light': '#E5E7EB',
        'border-default-light': '#D1D5DB',
        'border-focus-light': '#7C3AED',
      },
      backgroundImage: {
        'accent-gradient': 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
        'accent-gradient-light': 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)',
      },
      boxShadow: {
        'accent-glow': '0 0 20px rgba(139, 92, 246, 0.2)',
        'accent-glow-lg': '0 0 40px rgba(139, 92, 246, 0.3)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
}




