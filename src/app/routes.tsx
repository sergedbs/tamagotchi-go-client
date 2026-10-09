import { Navigate, Route, Routes } from 'react-router'
import { NotFound } from './NotFound.tsx'

export function AppRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/creatures" replace />} />
      <Route path="creatures" element={<main><h1>Tamagotchi Go</h1></main>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
