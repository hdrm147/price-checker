module.exports = {
  prefix: 'pc-',
  content: [
    './resources/**/*.{vue,js}',
  ],
  theme: {
    extend: {
      colors: {
        'price-up': '#ef4444',    // red - price increased
        'price-down': '#22c55e',  // green - price decreased
        'price-same': '#6b7280',  // gray - no change
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false, // Disable base styles to avoid conflicts with Nova
  },
}
