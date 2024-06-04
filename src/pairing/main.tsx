import ReactDOM from 'react-dom/client'
import '../../fonts.css'
import './style.css'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { Pairing } from './pairing'
import { ConnectionStatus } from './components/connection-status'
import { PopupWindow } from 'components'
import { ThemeProvider, createTheme } from '@mui/material'
import '@radixdlt/radix-dapp-toolkit/connect-button'

const theme = createTheme({
  typography: {
    fontFamily: 'IBM Plex Sans, sans-serif',
  },
  palette: {},
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <PopupWindow>
    <ThemeProvider theme={theme}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<ConnectionStatus />} />
          <Route path="/pairing" element={<Pairing />} />
        </Routes>
      </HashRouter>
    </ThemeProvider>
  </PopupWindow>,
)
