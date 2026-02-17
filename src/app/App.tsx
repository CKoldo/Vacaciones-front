import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/app/context/AuthContext';
import { ProtectedRoute } from '@/app/components/ProtectedRoute';
import { Login } from '@/app/components/Login';
import { Home } from '@/app/components/Home';
import { RegistroPersonal } from '@/app/components/RegistroPersonal';
import { RegistroVacaciones } from '@/app/components/RegistroVacaciones';
import { VisualizacionVacaciones } from '@/app/components/VisualizacionVacaciones';
import { PlantillaDeclaracion } from '@/app/components/PlantillaDeclaracion';
import { Administracion } from '@/app/components/Administracion';
import { Reprogramaciones } from '@/app/components/Reprogramaciones';
import { Toaster } from '@/app/components/ui/sonner';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/registro-personal"
            element={
              <ProtectedRoute>
                <RegistroPersonal />
              </ProtectedRoute>
            }
          />
          <Route
            path="/registro-vacaciones"
            element={
              <ProtectedRoute>
                <RegistroVacaciones />
              </ProtectedRoute>
            }
          />
          <Route
            path="/visualizacion-vacaciones"
            element={
              <ProtectedRoute>
                <VisualizacionVacaciones />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/plantilla-declaracion"
            element={
              <ProtectedRoute>
                <PlantillaDeclaracion />
              </ProtectedRoute>
            }
          />
          <Route
            path="/administracion"
            element={
              <ProtectedRoute>
                <Administracion />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reprogramaciones"
            element={
              <ProtectedRoute>
                <Reprogramaciones />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </AuthProvider>
  );
}