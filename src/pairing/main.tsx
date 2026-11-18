import ReactDOM from 'react-dom/client'
import { initTheme } from 'ui/theme'
import '../../fonts.css'
import './style.css'
import { App } from './app'

initTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App surface="popup" />,
)
