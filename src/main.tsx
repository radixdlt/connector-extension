import React from 'react'
import ReactDOM from 'react-dom/client'
import { Main } from './containers/main/main'
import '../fonts.css'
import { bootstrapApplication } from 'bootstrap-application'
import { subjects } from 'connections'

bootstrapApplication(subjects)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Main />
  </React.StrictMode>
)
