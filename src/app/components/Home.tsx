import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/context/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { CalendarDays, Users, CalendarPlus, LogOut, Calendar, FileText, Settings, RefreshCcw } from 'lucide-react';

export function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <CalendarDays className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Sistema de Gestión de Vacaciones
              </h1>
              <p className="text-sm text-gray-500">
                Bienvenido, {user?.username}
              </p>
            </div>
          </div>
          <Button onClick={handleLogout} variant="outline" className="gap-2">
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Panel de Control</h2>
          <p className="text-gray-600">
            Gestione el personal y los cronogramas de vacaciones desde aquí
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Tarjeta Registro Personal */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/registro-personal')}>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <CardTitle>Registro de Personal</CardTitle>
              </div>
              <CardDescription>
                Registre nuevos empleados y gestione la información del personal por año
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate('/registro-personal')}>
                Ir a Registro de Personal
              </Button>
            </CardContent>
          </Card>

          {/* Tarjeta Cronograma Vacaciones */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/registro-vacaciones')}>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-green-100 rounded-lg">
                  <CalendarPlus className="w-6 h-6 text-green-600" />
                </div>
                <CardTitle>Cronograma de Vacaciones</CardTitle>
              </div>
              <CardDescription>
                Gestione y programe las vacaciones del personal según los periodos establecidos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate('/registro-vacaciones')}>
                Ir a Cronograma de Vacaciones
              </Button>
            </CardContent>
          </Card>

          {/* Tarjeta Visualización Vacaciones */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/visualizacion-vacaciones')}>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-indigo-100 rounded-lg">
                  <Calendar className="w-6 h-6 text-indigo-600" />
                </div>
                <CardTitle>Visualización de Vacaciones</CardTitle>
              </div>
              <CardDescription>
                Consulte los registros de vacaciones y vea cuántos días faltan por programar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate('/visualizacion-vacaciones')}>
                Ver Registros de Vacaciones
              </Button>
            </CardContent>
          </Card>

          {/* Tarjeta Reprogramaciones */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/reprogramaciones')}>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <RefreshCcw className="w-6 h-6 text-purple-600" />
                </div>
                <CardTitle>Reprogramaciones</CardTitle>
              </div>
              <CardDescription>
                Consulte y reprograme vacaciones activas con fechas posteriores a hoy
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate('/reprogramaciones')}>
                Abrir módulo de reprogramaciones
              </Button>
            </CardContent>
          </Card>

          {/* Tarjeta Administración */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/administracion')}>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <Settings className="w-6 h-6 text-orange-600" />
                </div>
                <CardTitle>Administración</CardTitle>
              </div>
              <CardDescription>
                Gestione los documentos ESINAD asociados a las vacaciones y reprogramaciones
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate('/administracion')}>
                Ir a Administración
              </Button>
            </CardContent>
          </Card>

        </div>

        {/* Información del Sistema */}
        <Card className="mt-8 bg-indigo-50 border-indigo-200">
          <CardHeader>
            <CardTitle className="text-indigo-900">Reglas del Sistema de Vacaciones</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-indigo-800 space-y-2">
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong>30 días de vacaciones</strong> por cada año trabajado en la empresa
              </li>
              <li>
                El periodo vacacional comienza <strong>un año después</strong> de la fecha de ingreso
              </li>
              <li>
                <strong>7 días flexibles:</strong> Pueden fraccionarse en rangos mínimos de 1 día
              </li>
              <li>
                <strong>23 días en bloque:</strong> Deben solicitarse en rangos mínimos de 7 días
              </li>
              <li>
                Si selecciona un <strong>viernes</strong>, automáticamente se incluyen sábado y domingo
              </li>
              <li>
                El sistema alertará sobre el cumplimiento de los días flexibles y validaciones
              </li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}