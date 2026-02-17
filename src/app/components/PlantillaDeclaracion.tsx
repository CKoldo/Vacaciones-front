import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Slider } from '@/app/components/ui/slider';
import { Switch } from '@/app/components/ui/switch';
import { ArrowLeft, Save, Eye, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';

interface PlantillaConfig {
  // Título
  titulo: string;
  tituloSize: number;
  tituloY: number;
  
  // Número
  numeroSize: number;
  numeroY: number;
  
  // Información del empleado
  mostrarNombre: boolean;
  nombreY: number;
  mostrarPuesto: boolean;
  puestoY: number;
  mostrarEmail: boolean;
  emailY: number;
  infoSize: number;
  
  // Contenido
  contenidoSize: number;
  contenidoY: number;
  
  // Fecha
  mostrarFecha: boolean;
  fechaY: number;
  
  // Firma
  mostrarFirma: boolean;
  firmaTexto: string;
  firmaLineaY: number;
  firmaTextoY: number;
}

const defaultTemplate: PlantillaConfig = {
  titulo: 'DECLARACIÓN JURADA',
  tituloSize: 18,
  tituloY: 20,
  numeroSize: 14,
  numeroY: 35,
  mostrarNombre: true,
  nombreY: 55,
  mostrarPuesto: true,
  puestoY: 65,
  mostrarEmail: true,
  emailY: 75,
  infoSize: 12,
  contenidoSize: 10,
  contenidoY: 95,
  mostrarFecha: true,
  fechaY: 270,
  mostrarFirma: true,
  firmaTexto: 'Firma del Empleado',
  firmaLineaY: 265,
  firmaTextoY: 275,
};

export function PlantillaDeclaracion() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<PlantillaConfig>(defaultTemplate);

  useEffect(() => {
    // Cargar plantilla guardada
    const savedTemplate = localStorage.getItem('dj_template');
    if (savedTemplate) {
      setConfig(JSON.parse(savedTemplate));
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('dj_template', JSON.stringify(config));
    toast.success('Plantilla guardada exitosamente');
  };

  const handleReset = () => {
    setConfig(defaultTemplate);
    localStorage.removeItem('dj_template');
    toast.success('Plantilla restaurada a valores por defecto');
  };

  const handlePreview = () => {
    const doc = new jsPDF();

    // Título
    doc.setFontSize(config.tituloSize);
    doc.text(config.titulo, 105, config.tituloY, { align: 'center' });

    // Número
    doc.setFontSize(config.numeroSize);
    doc.text('N° 1', 105, config.numeroY, { align: 'center' });

    // Información del empleado (ejemplo)
    doc.setFontSize(config.infoSize);
    if (config.mostrarNombre) {
      doc.text('Empleado: Juan Pérez García', 20, config.nombreY);
    }
    if (config.mostrarPuesto) {
      doc.text('Puesto: Desarrollador Senior', 20, config.puestoY);
    }
    if (config.mostrarEmail) {
      doc.text('Email: juan.perez@example.com', 20, config.emailY);
    }

    // Contenido (ejemplo)
    doc.setFontSize(config.contenidoSize);
    const contenidoEjemplo = 'Yo, el abajo firmante, declaro bajo juramento que la información proporcionada en este documento es verdadera y completa. Me comprometo a notificar cualquier cambio que pueda afectar la validez de esta declaración.';
    const splitText = doc.splitTextToSize(contenidoEjemplo, 170);
    doc.text(splitText, 20, config.contenidoY);

    // Fecha
    if (config.mostrarFecha) {
      doc.setFontSize(10);
      const today = new Date().toLocaleDateString('es-ES');
      doc.text(`Fecha: ${today}`, 20, config.fechaY);
    }

    // Firma
    if (config.mostrarFirma) {
      doc.setFontSize(10);
      doc.line(120, config.firmaLineaY, 180, config.firmaLineaY);
      doc.text(config.firmaTexto, 135, config.firmaTextoY, { align: 'center' });
    }

    // Abrir en nueva ventana
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    window.open(url, '_blank');
    toast.success('Vista previa generada');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Button onClick={() => navigate('/imprimir-tdr')} variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Configurar Plantilla Declaración Jurada
              </h1>
              <p className="text-sm text-gray-500">
                Personalice el formato y estructura de las declaraciones juradas
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Panel de Configuración */}
          <div className="space-y-6">
            {/* Título */}
            <Card>
              <CardHeader>
                <CardTitle>Título del Documento</CardTitle>
                <CardDescription>Configure el título principal</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="titulo">Texto del Título</Label>
                  <Input
                    id="titulo"
                    value={config.titulo}
                    onChange={(e) => setConfig({ ...config, titulo: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tamaño de Fuente: {config.tituloSize}pt</Label>
                  <Slider
                    value={[config.tituloSize]}
                    onValueChange={([value]) => setConfig({ ...config, tituloSize: value })}
                    min={10}
                    max={30}
                    step={1}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Posición Vertical: {config.tituloY}mm</Label>
                  <Slider
                    value={[config.tituloY]}
                    onValueChange={([value]) => setConfig({ ...config, tituloY: value })}
                    min={10}
                    max={50}
                    step={1}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Número */}
            <Card>
              <CardHeader>
                <CardTitle>Número de Declaración</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Tamaño de Fuente: {config.numeroSize}pt</Label>
                  <Slider
                    value={[config.numeroSize]}
                    onValueChange={([value]) => setConfig({ ...config, numeroSize: value })}
                    min={8}
                    max={20}
                    step={1}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Posición Vertical: {config.numeroY}mm</Label>
                  <Slider
                    value={[config.numeroY]}
                    onValueChange={([value]) => setConfig({ ...config, numeroY: value })}
                    min={20}
                    max={60}
                    step={1}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Información del Empleado */}
            <Card>
              <CardHeader>
                <CardTitle>Información del Empleado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Tamaño de Fuente: {config.infoSize}pt</Label>
                  <Slider
                    value={[config.infoSize]}
                    onValueChange={([value]) => setConfig({ ...config, infoSize: value })}
                    min={8}
                    max={16}
                    step={1}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="mostrar-nombre">Mostrar Nombre</Label>
                  <Switch
                    id="mostrar-nombre"
                    checked={config.mostrarNombre}
                    onCheckedChange={(checked) => setConfig({ ...config, mostrarNombre: checked })}
                  />
                </div>
                {config.mostrarNombre && (
                  <div className="space-y-2 ml-4">
                    <Label>Posición: {config.nombreY}mm</Label>
                    <Slider
                      value={[config.nombreY]}
                      onValueChange={([value]) => setConfig({ ...config, nombreY: value })}
                      min={40}
                      max={100}
                      step={1}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Label htmlFor="mostrar-puesto">Mostrar Puesto</Label>
                  <Switch
                    id="mostrar-puesto"
                    checked={config.mostrarPuesto}
                    onCheckedChange={(checked) => setConfig({ ...config, mostrarPuesto: checked })}
                  />
                </div>
                {config.mostrarPuesto && (
                  <div className="space-y-2 ml-4">
                    <Label>Posición: {config.puestoY}mm</Label>
                    <Slider
                      value={[config.puestoY]}
                      onValueChange={([value]) => setConfig({ ...config, puestoY: value })}
                      min={40}
                      max={100}
                      step={1}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Label htmlFor="mostrar-email">Mostrar Email</Label>
                  <Switch
                    id="mostrar-email"
                    checked={config.mostrarEmail}
                    onCheckedChange={(checked) => setConfig({ ...config, mostrarEmail: checked })}
                  />
                </div>
                {config.mostrarEmail && (
                  <div className="space-y-2 ml-4">
                    <Label>Posición: {config.emailY}mm</Label>
                    <Slider
                      value={[config.emailY]}
                      onValueChange={([value]) => setConfig({ ...config, emailY: value })}
                      min={40}
                      max={100}
                      step={1}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contenido */}
            <Card>
              <CardHeader>
                <CardTitle>Contenido de la Declaración</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Tamaño de Fuente: {config.contenidoSize}pt</Label>
                  <Slider
                    value={[config.contenidoSize]}
                    onValueChange={([value]) => setConfig({ ...config, contenidoSize: value })}
                    min={8}
                    max={14}
                    step={1}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Posición Vertical: {config.contenidoY}mm</Label>
                  <Slider
                    value={[config.contenidoY]}
                    onValueChange={([value]) => setConfig({ ...config, contenidoY: value })}
                    min={70}
                    max={150}
                    step={1}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Fecha y Firma */}
            <Card>
              <CardHeader>
                <CardTitle>Fecha y Firma</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="mostrar-fecha">Mostrar Fecha</Label>
                  <Switch
                    id="mostrar-fecha"
                    checked={config.mostrarFecha}
                    onCheckedChange={(checked) => setConfig({ ...config, mostrarFecha: checked })}
                  />
                </div>
                {config.mostrarFecha && (
                  <div className="space-y-2 ml-4">
                    <Label>Posición: {config.fechaY}mm</Label>
                    <Slider
                      value={[config.fechaY]}
                      onValueChange={([value]) => setConfig({ ...config, fechaY: value })}
                      min={200}
                      max={280}
                      step={1}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Label htmlFor="mostrar-firma">Mostrar Firma</Label>
                  <Switch
                    id="mostrar-firma"
                    checked={config.mostrarFirma}
                    onCheckedChange={(checked) => setConfig({ ...config, mostrarFirma: checked })}
                  />
                </div>
                {config.mostrarFirma && (
                  <>
                    <div className="space-y-2 ml-4">
                      <Label>Texto de Firma</Label>
                      <Input
                        value={config.firmaTexto}
                        onChange={(e) => setConfig({ ...config, firmaTexto: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2 ml-4">
                      <Label>Posición Línea: {config.firmaLineaY}mm</Label>
                      <Slider
                        value={[config.firmaLineaY]}
                        onValueChange={([value]) => setConfig({ ...config, firmaLineaY: value })}
                        min={200}
                        max={280}
                        step={1}
                      />
                    </div>
                    <div className="space-y-2 ml-4">
                      <Label>Posición Texto: {config.firmaTextoY}mm</Label>
                      <Slider
                        value={[config.firmaTextoY]}
                        onValueChange={([value]) => setConfig({ ...config, firmaTextoY: value })}
                        min={200}
                        max={290}
                        step={1}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Panel de Acciones y Preview */}
          <div className="space-y-6">
            <Card className="lg:sticky lg:top-4">
              <CardHeader>
                <CardTitle>Acciones</CardTitle>
                <CardDescription>
                  Guarde, previsualice o restaure la plantilla
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button onClick={handleSave} className="w-full gap-2">
                  <Save className="w-4 h-4" />
                  Guardar Plantilla
                </Button>

                <Button onClick={handlePreview} variant="outline" className="w-full gap-2">
                  <Eye className="w-4 h-4" />
                  Vista Previa
                </Button>

                <Button onClick={handleReset} variant="outline" className="w-full gap-2">
                  <RotateCcw className="w-4 h-4" />
                  Restaurar Valores por Defecto
                </Button>
              </CardContent>
            </Card>

            {/* Información */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-900 text-sm">Guía de Uso</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-2">
                <p>
                  <strong>Personalice su plantilla:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Ajuste tamaños de fuente para cada sección</li>
                  <li>Modifique posiciones verticales para espaciado perfecto</li>
                  <li>Active o desactive elementos según sus necesidades</li>
                  <li>Use la vista previa para verificar cambios</li>
                  <li>Los cambios se aplicarán a todas las nuevas declaraciones</li>
                </ul>
                <p className="mt-3 text-xs text-blue-600">
                  Nota: Las medidas están en milímetros (mm) y puntos (pt). Un PDF A4 tiene 297mm de alto.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
