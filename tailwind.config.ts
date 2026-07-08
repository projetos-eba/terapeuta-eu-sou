import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: {
        '2xl': '1440px',
      },
    },
    extend: {
      colors: {
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
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        brand: {
          primary: 'var(--tes-color-brand-primary)',
          primaryHover: 'var(--tes-color-brand-primary-hover)',
          deep: 'var(--tes-color-brand-deep)',
          lavender: 'var(--tes-color-brand-lavender)',
          lavenderSoft: 'var(--tes-color-brand-lavender-soft)',
          cyan: 'var(--tes-color-brand-cyan)',
          cyanSoft: 'var(--tes-color-brand-cyan-soft)',
          mint: 'var(--tes-color-brand-mint)',
        },
        surface: {
          default: 'var(--tes-color-surface-default)',
          page: 'var(--tes-color-surface-page)',
          soft: 'var(--tes-color-surface-soft)',
          mist: 'var(--tes-color-surface-mist)',
          elevated: 'var(--tes-color-surface-elevated)',
        },
        tesText: {
          primary: 'var(--tes-color-text-primary)',
          secondary: 'var(--tes-color-text-secondary)',
          muted: 'var(--tes-color-text-muted)',
          subtle: 'var(--tes-color-text-subtle)',
          inverse: 'var(--tes-color-text-inverse)',
          link: 'var(--tes-color-text-link)',
        },
        status: {
          success: 'var(--tes-color-status-success)',
          successBg: 'var(--tes-color-status-success-bg)',
          warning: 'var(--tes-color-status-warning)',
          warningBg: 'var(--tes-color-status-warning-bg)',
          danger: 'var(--tes-color-status-danger)',
          dangerBg: 'var(--tes-color-status-danger-bg)',
          info: 'var(--tes-color-status-info)',
          infoBg: 'var(--tes-color-status-info-bg)',
        },
      },
      fontFamily: {
        display: ['var(--tes-font-display)'],
        sans: ['var(--tes-font-body)'],
      },
      borderRadius: {
        xs: 'var(--tes-radius-xs)',
        sm: 'var(--tes-radius-sm)',
        md: 'var(--tes-radius-md)',
        card: 'var(--tes-radius-card)',
        panel: 'var(--tes-radius-panel)',
        hero: 'var(--tes-radius-hero)',
      },
      boxShadow: {
        soft: 'var(--tes-shadow-soft)',
        card: 'var(--tes-shadow-card)',
        float: 'var(--tes-shadow-float)',
        focus: 'var(--tes-shadow-focus)',
      },
      spacing: {
        sidebar: 'var(--tes-layout-sidebar-width)',
        topbar: 'var(--tes-layout-topbar-height)',
      },
      zIndex: {
        sticky: '10',
        dropdown: '30',
        toast: '50',
        modal: '70',
        overlay: '80',
        tooltip: '90',
      },
    },
  },
  plugins: [],
};

export default config;
