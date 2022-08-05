import { bootstrapApplication } from './bootstrap-application'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './containers/main'
import '../fonts.css'
import { subjects } from 'connections'

bootstrapApplication(subjects)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
