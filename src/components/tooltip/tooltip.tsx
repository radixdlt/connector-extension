import { styled, keyframes } from 'stitches.config'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import Box from 'components/box'
import React from 'react'

const slideUpAndFade = keyframes({
  '0%': { opacity: 0, transform: 'translateY(2px)' },
  '100%': { opacity: 1, transform: 'translateY(0)' },
})

const slideRightAndFade = keyframes({
  '0%': { opacity: 0, transform: 'translateX(-2px)' },
  '100%': { opacity: 1, transform: 'translateX(0)' },
})

const slideDownAndFade = keyframes({
  '0%': { opacity: 0, transform: 'translateY(-2px)' },
  '100%': { opacity: 1, transform: 'translateY(0)' },
})

const slideLeftAndFade = keyframes({
  '0%': { opacity: 0, transform: 'translateX(2px)' },
  '100%': { opacity: 1, transform: 'translateX(0)' },
})

const StyledContent = styled(TooltipPrimitive.Content, {
  borderRadius: '$sm',
  padding: '$sm $md',
  fontSize: '$sm',
  color: '$primary',
  backgroundColor: '$background',
  boxShadow:
    'hsl(206 22% 7% / 35%) 0px 10px 38px -10px, hsl(206 22% 7% / 20%) 0px 10px 20px -15px',
  '@media (prefers-reduced-motion: no-preference)': {
    animationDuration: '400ms',
    animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
    animationFillMode: 'forwards',
    willChange: 'transform, opacity',
    '&[data-state="delayed-open"]': {
      '&[data-side="top"]': { animationName: slideDownAndFade },
      '&[data-side="right"]': { animationName: slideLeftAndFade },
      '&[data-side="bottom"]': { animationName: slideUpAndFade },
      '&[data-side="left"]': { animationName: slideRightAndFade },
    },
  },
})

const StyledArrow = styled(TooltipPrimitive.Arrow, {
  fill: '$background',
})

const TooltipC = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger

interface TooltipProps {
  children: React.ReactElement
  description: string
}

const Tooltip = ({ children, description }: TooltipProps) => (
  <TooltipC>
    <TooltipTrigger asChild>
      <Box py="none" justify="center">
        {children}
      </Box>
    </TooltipTrigger>
    <StyledContent side="top" align="center" sideOffset={3}>
      {description}
      <StyledArrow />
    </StyledContent>
  </TooltipC>
)

export default Tooltip
