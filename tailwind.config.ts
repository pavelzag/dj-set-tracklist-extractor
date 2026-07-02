import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0d0d14',
          card: '#13131f',
          hover: '#1a1a2e',
        },
      },
    },
  },
  plugins: [],
}

export default config
