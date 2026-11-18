import ReactDOM from 'react-dom/client'
import { initTheme } from 'ui/theme'
import '../../fonts.css'
import '../pairing/style.css'
import { App } from 'pairing/app'

initTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App surface="sidePanel" />,
)
