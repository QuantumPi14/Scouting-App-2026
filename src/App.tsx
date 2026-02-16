import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { TeamChoosePage } from './pages/TeamChoosePage'
import { AddDataPage } from './pages/AddDataPage'
import { CurrentDataPage } from './pages/CurrentDataPage'
import { AdminPage } from './pages/AdminPage'
import { QRCreatePage } from './pages/QRCreatePage'
import { QRScanPage } from './pages/QRScanPage'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/team/:competitionId/:teamNumber" element={<TeamChoosePage />} />
        <Route path="/team/:competitionId/:teamNumber/add" element={<AddDataPage />} />
        <Route path="/team/:competitionId/:teamNumber/current" element={<CurrentDataPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/qr/create" element={<QRCreatePage />} />
        <Route path="/qr/scan" element={<QRScanPage />} />
      </Routes>
    </Layout>
  )
}

export default App
