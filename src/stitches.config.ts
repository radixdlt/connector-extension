import { createStitches } from '@stitches/react'

const colors = {
  darkBlue: '#003057',
  blue: '#052CC0',
  white: '#fff',
  green: '#00ab84',
  grey: '#f4f5f9',
  darkGrey: '#6e7781',
  red: 'red',
  orange: 'orange',
}

const space = {
  0: '2px',
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '40px',
  '3xl': '48px',
  '4xl': '64px',
  '5xl': '80px',
  '6xl': '96px',
  '7xl': '160px',
}

type spaceKeys = `$${keyof typeof space}`

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
      background: colors.white,
      action: colors.darkBlue,
      primary: colors.darkBlue,
      secondary: colors.green,
      error: colors.red,
      info: colors.blue,
      success: colors.green,
      warning: colors.orange,
      primaryButton: colors.darkBlue,
      primaryButtonHover: colors.green,
      primaryButtonText: colors.white,
      primaryGhostButton: colors.white,
      primaryGhostButtonText: colors.darkBlue,
      primaryGhostButtonHover: colors.blue,
      primaryGhostButtonHoverText: colors.white,
      borderColor: colors.grey,
      grey: colors.grey,
      muted: colors.darkGrey,
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
    space,
    fontWeights: {
      200: '200',
      400: '400',
      600: '600',
    },
    sizes: {
      1: '100%',
    },
    borderWidths: {
      sm: '1px',
      md: '10px',
    },
  },
  media: {
    bp1: '(min-width: 480px)',
  },
  utils: {
    p: (value: spaceKeys) => ({
      paddingTop: value,
      paddingBottom: value,
      paddingLeft: value,
      paddingRight: value,
    }),
    pl: (value: spaceKeys) => ({
      paddingLeft: value,
    }),
    py: (value: spaceKeys) => ({
      paddingTop: value,
      paddingBottom: value,
    }),
    px: (value: spaceKeys) => ({
      paddingLeft: value,
      paddingRight: value,
    }),
    my: (value: spaceKeys) => ({
      marginTop: value,
      marginBottom: value,
    }),
    mx: (value: spaceKeys) => ({
      marginLeft: value,
      marginRight: value,
    }),
    mt: (value: spaceKeys) => ({ marginTop: value }),
    mb: (value: spaceKeys) => ({ marginBottom: value }),
    ml: (value: spaceKeys) => ({ marginLeft: value }),
    mr: (value: spaceKeys) => ({ marginRight: value }),
  },
})

globalCss({
  '*': {
    fontFamily: 'IBM Plex Sans',
    fontWeight: '400',
  },
})()
