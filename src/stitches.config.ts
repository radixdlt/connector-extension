import { createStitches } from '@stitches/react'

const colors = {
  darkBlue: '#003057',
  blue: '#052CC0',
  white: '#fff',
  green: '#00ab84',
}

export const {
  styled,
  css,
  globalCss,
  keyframes,
  getCssText,
  theme,
  createTheme,
  config,
} = createStitches({
  theme: {
    colors: {
      primaryButton: colors.darkBlue,
      primaryText: colors.darkBlue,
      primaryButtonHover: colors.green,
      ghostButtonHover: colors.blue,
      white: colors.white,
      gray400: 'gainsboro',
      gray500: 'lightgray',
    },
    fontSizes: {
      xs: '12px',
      sm: '14px',
      md: '16px',
      lg: '18px',
      xl: '20px',
      '2xl': '24px',
      '3xl': '28px',
      '4xl': '32px',
      '5xl': '36px',
      '6xl': '42px',
      '7xl': '48px',
      '8xl': '54px',
      '9xl': '60px',
      '10xl': '68px',
      '11xl': '76px',
      '12xl': '84px',
      '13xl': '92px',
    },
    radii: {
      sm: '3px',
      md: '10px',
      lg: '50%',
    },
    space: {
      0: '2px',
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '24',
      xl: '32px',
      '2xl': '40px',
      '3xl': '48px',
      '4xl': '64px',
      '5xl': '80px',
      '6xl': '96px',
      '7xl': '160px',
    },
  },
  media: {
    bp1: '(min-width: 480px)',
  },
  utils: {
    marginX: (value) => ({ marginLeft: value, marginRight: value }),
  },
})

globalCss({
  '*': {
    fontFamily: 'IBM Plex Sans',
    fontWeight: '400',
  },
})()
