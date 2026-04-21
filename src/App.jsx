import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout.jsx'
import Overview from './views/Overview.jsx'
import DistrictMonitoring from './views/DistrictMonitoring.jsx'
import VerificationQueue from './views/VerificationQueue.jsx'
import SchoolDetail from './views/SchoolDetail.jsx'
import ImageReview from './views/ImageReview.jsx'
import MapView from './views/MapView.jsx'
import Analytics from './views/Analytics.jsx'
import DataQuality from './views/DataQuality.jsx'
import Admin from './views/Admin.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Overview />} />
        <Route path="districts" element={<DistrictMonitoring />} />
        <Route path="queue" element={<VerificationQueue />} />
        <Route path="map" element={<MapView />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="data-quality" element={<DataQuality />} />
        <Route path="admin" element={<Admin />} />
        <Route path="schools/:id" element={<SchoolDetail />} />
        <Route path="schools/:id/image/:imageId" element={<ImageReview />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
