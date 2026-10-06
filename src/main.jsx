import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { councilBySlug } from './councils.js'
import Landing from './pages/Landing.jsx'
import CouncilApp from './pages/CouncilApp.jsx'
import UpdateManager from './components/UpdateManager.jsx'
import BugReportWidget from './components/BugReportWidget.jsx'

// Mini-router: /<slug> = výsledky zastupitelstva (viz src/councils.js),
// cokoli jiného = přehled. Na Vercelu má každý slug rewrite ve vercel.json.
const slug = window.location.pathname.replace(/^\/+|\/+$/g, '')
const council = councilBySlug(slug)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {council ? <CouncilApp council={council} /> : <Landing />}
    <UpdateManager />
    <BugReportWidget raised={!!council} />
  </StrictMode>,
)
