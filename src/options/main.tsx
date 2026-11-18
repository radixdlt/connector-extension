import ReactDOM from 'react-dom/client'
import { initTheme } from 'ui/theme'
import '../../fonts.css'
import 'ui/tokens.css'
import { Options } from 'options/options'

initTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(<Options />)
