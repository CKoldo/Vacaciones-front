import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import {
  ArrowLeft,
  UserPlus,
  Trash2,
  CalendarDays,
  Download,
} from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import type { Personal } from "@/app/types";
import { apiFetch } from "@/app/api";
import { useAuth } from "@/app/context/AuthContext";
import { format, parseISO } from "date-fns";
import { el, es } from "date-fns/locale";
import { generateUuid } from "@/app/utils/id";

export function RegistroPersonal() {
  const navigate = useNavigate();
  const [personal, setPersonal] = useState<Personal[]>([]);
  const fileExcelRef = useRef<HTMLInputElement | null>(null);
  const [formData, setFormData] = useState({
    nombre: "",
    apellido: "",
    fechaIngreso: "",
    email: "",
    puesto: "",
  });

  const { isAuthenticated } = useAuth();

  useEffect(() => {
    // Cargar personal desde backend si está autenticado
    async function load() {
      try {
        const data = await apiFetch("/api/personal");
        setPersonal(data || []);
      } catch (err) {
        // Si no hay token o error, mantener vacío
        setPersonal([]);
      }
    }
    if (isAuthenticated) load();
    else setPersonal([]);
  }, [isAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.nombre ||
      !formData.apellido ||
      !formData.fechaIngreso ||
      !formData.email ||
      !formData.puesto
    ) {
      toast.error("Por favor, complete todos los campos");
      return;
    }

    const nuevoPersonal: Personal = {
      id: generateUuid(),
      ...formData,
    };
    // Guardar personal en servidor
    async function guardarPersonal() {
      try {
        await apiFetch("/api/personal", {
          method: "POST",
          body: JSON.stringify({
            id: nuevoPersonal.id,
            nombre: nuevoPersonal.nombre,
            apellido: nuevoPersonal.apellido,
            email: nuevoPersonal.email,
            puesto: nuevoPersonal.puesto,
            fechaIngreso: nuevoPersonal.fechaIngreso,
          }),
        });
        const updatedPersonal = [...personal, nuevoPersonal];
        setPersonal(updatedPersonal);
        toast.success(
          `Personal ${formData.nombre} ${formData.apellido} registrado exitosamente`,
        );
        // Limpiar formulario
        setFormData({
          nombre: "",
          apellido: "",
          fechaIngreso: "",
          email: "",
          puesto: "",
        });
      } catch (err) {
        toast.error("Error al guardar en servidor");
      }
    }
    guardarPersonal();
  };
  //funcion eliminar personal, ya eiste endpoint DELETE en backend
  async function eliminarPersonal(id: string) {
    try {
      await apiFetch(`/api/personal/${id}`, { method: "DELETE" });
      const updatedPersonal = personal.filter((p) => p.id !== id);
      setPersonal(updatedPersonal);
      toast.success("Personal eliminado exitosamente");
    } catch (err) {
      toast.error("Error eliminando personal");
    }
  }

  /*
  const handleDelete = (id: string) => {
    try {
      // No existe endpoint DELETE en backend básico; simular eliminación local y sugerir backend
      apiFetch(`/api/personal/${id}`, { method: 'DELETE' });
      const updatedPersonal = personal.filter((p) => p.id !== id);
      setPersonal(updatedPersonal);
      toast.success('Personal eliminado (local)');
    } catch {
      toast.error('Error eliminando');
    }
  };
  */

  // Exportar/Importar/Limpiar
  const exportarPersonalJSON = () => {
    if (!personal.length) {
      toast.error("No hay personal para exportar");
      return;
    }
    const blob = new Blob([JSON.stringify(personal, null, 2)], {
      type: "application/json",
    });
    saveAs(
      blob,
      `SISTEMA_DIGC_Personal_${new Date().toISOString().split("T")[0]}.json`,
    );
    toast.success("Personal exportado a JSON");
  };

  const exportarVacacionesJSON = () => {
    const raw = localStorage.getItem("cronogramas");
    const cronogramas = raw ? JSON.parse(raw) : [];
    if (!cronogramas.length) {
      toast.error("No hay vacaciones para exportar");
      return;
    }
    const blob = new Blob([JSON.stringify(cronogramas, null, 2)], {
      type: "application/json",
    });
    saveAs(
      blob,
      `SISTEMA_DIGC_Vacaciones_${new Date().toISOString().split("T")[0]}.json`,
    );
    toast.success("Vacaciones exportadas a JSON");
  };

  const handleImportExcelPersonal = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        const nuevos: any[] = rows.map((r, idx) => {
          const get = (keys: string[]) => {
            for (const k of keys) {
              if (
                r[k] !== undefined &&
                r[k] !== null &&
                String(r[k]).trim() !== ""
              )
                return String(r[k]).trim();
            }
            return "";
          };
          const nombre = get([
            "nombre",
            "Nombre",
            "NOMBRE",
            "firstName",
            "FirstName",
          ]);
          const apellido = get([
            "apellido",
            "Apellido",
            "APELLIDO",
            "lastName",
            "LastName",
          ]);
          const fechaIngreso = get([
            "fechaIngreso",
            "fecha_ingreso",
            "FechaIngreso",
            "Fecha de Ingreso",
            "fecha de ingreso",
          ]);
          const email = get(["email", "Email", "EMAIL"]);
          const puesto = get(["puesto", "Puesto", "cargo", "Cargo"]);
          const id = get(["id", "ID"]) || generateUuid();
          return { id, nombre, apellido, fechaIngreso, email, puesto };
        });

        localStorage.setItem("personal", JSON.stringify(nuevos));
        setPersonal(nuevos);
        toast.success("Personal importado desde Excel");
      } catch (err) {
        toast.error("Error al leer el archivo Excel");
      }
    };
    reader.readAsArrayBuffer(file);
    e.currentTarget.value = "";
  };

  const limpiarDatos = () => {
    localStorage.removeItem("personal");
    localStorage.removeItem("cronogramas");
    setPersonal([]);
    toast.success("Datos de personal y vacaciones limpiados");
  };

  const formatearFecha = (fecha: string) => {
    try {
      return format(parseISO(fecha), "dd/MM/yyyy", { locale: es });
    } catch {
      return fecha;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate("/home")}
              variant="ghost"
              size="icon"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <UserPlus className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Registro de Personal
                </h1>
                <p className="text-sm text-gray-500">
                  Gestione el personal de la empresa
                </p>
              </div>
            </div>
            <div className="ml-auto flex gap-2">
              <Button
                onClick={exportarPersonalJSON}
                variant="outline"
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Exportar Personal (JSON)
              </Button>
              <Button
                onClick={exportarVacacionesJSON}
                variant="outline"
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Exportar Vacaciones (JSON)
              </Button>
              <Button
                onClick={() => fileExcelRef.current?.click()}
                variant="outline"
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Importar Personal (Excel)
              </Button>
              <Button
                onClick={limpiarDatos}
                variant="destructive"
                className="gap-2"
              >
                Limpiar Datos
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <input
          ref={fileExcelRef}
          type="file"
          accept=".xlsx, .xls"
          onChange={handleImportExcelPersonal}
          style={{ display: "none" }}
        />
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Formulario de Registro */}
          <Card>
            <CardHeader>
              <CardTitle>Nuevo Personal</CardTitle>
              <CardDescription>
                Complete los datos del nuevo empleado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre</Label>
                    <Input
                      id="nombre"
                      placeholder="Nombre"
                      value={formData.nombre}
                      onChange={(e) =>
                        setFormData({ ...formData, nombre: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apellido">Apellido</Label>
                    <Input
                      id="apellido"
                      placeholder="Apellido"
                      value={formData.apellido}
                      onChange={(e) =>
                        setFormData({ ...formData, apellido: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="puesto">Puesto</Label>
                  <Input
                    id="puesto"
                    placeholder="Ej: Desarrollador, Gerente, etc."
                    value={formData.puesto}
                    onChange={(e) =>
                      setFormData({ ...formData, puesto: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fechaIngreso">Fecha de Ingreso</Label>
                  <Input
                    id="fechaIngreso"
                    type="date"
                    value={formData.fechaIngreso}
                    onChange={(e) =>
                      setFormData({ ...formData, fechaIngreso: e.target.value })
                    }
                  />
                  <p className="text-xs text-gray-500">
                    El periodo vacacional comenzará un año después de esta fecha
                  </p>
                </div>

                <Button type="submit" className="w-full gap-2">
                  <UserPlus className="w-4 h-4" />
                  Registrar Personal
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Lista de Personal */}
          <Card>
            <CardHeader>
              <CardTitle>Personal Registrado</CardTitle>
              <CardDescription>
                {personal.length}{" "}
                {personal.length === 1
                  ? "empleado registrado"
                  : "empleados registrados"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {personal.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No hay personal registrado aún</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Puesto</TableHead>
                        <TableHead>Ingreso</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {personal.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">
                            {p.nombre} {p.apellido}
                          </TableCell>
                          <TableCell>{p.email}</TableCell>
                          <TableCell>{p.puesto}</TableCell>
                          <TableCell>
                            {formatearFecha(p.fechaIngreso)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => eliminarPersonal(p.id)}
                              //handleDelete(p.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
