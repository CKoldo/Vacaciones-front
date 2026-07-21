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
import { generarCronogramasVacacionales } from "@/app/utils/vacationUtils";

export function RegistroPersonal() {
  const navigate = useNavigate();
  const [personal, setPersonal] = useState<Personal[]>([]);
  const fileExcelRef = useRef<HTMLInputElement | null>(null);
  const [formData, setFormData] = useState({
    dni: "",
    nombre: "",
    apellido: "",
    regimen_laboral: "",
    ue: "",
    dependencia: "",
    email: "",
    fechaIngreso: "",
  });

  const { isAuthenticated } = useAuth();

  const parseExcelDateValue = (value: unknown): string => {
    if (value === null || value === undefined) return "";

    if (typeof value === "number" && Number.isFinite(value)) {
      const date = new Date(Date.UTC(1899, 11, 30));
      date.setUTCDate(date.getUTCDate() + value);
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return "";

      if (/^\d+$/.test(trimmed)) {
        const serial = Number(trimmed);
        if (Number.isFinite(serial)) {
          const date = new Date(Date.UTC(1899, 11, 30));
          date.setUTCDate(date.getUTCDate() + serial);
          return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
        }
      }

      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) {
        return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-${String(parsed.getUTCDate()).padStart(2, "0")}`;
      }
    }

    return String(value).trim();
  };

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
      !formData.dni ||
      !formData.nombre ||
      !formData.apellido ||
      !formData.regimen_laboral ||
      !formData.ue ||
      !formData.dependencia ||
      !formData.email ||
      !formData.fechaIngreso
    ) {
      toast.error("Por favor, complete todos los campos");
      return;
    }

    const nuevoPersonal: Personal = {
      id: generateUuid(),
      ...formData,
    };
    const payload = {
      id: nuevoPersonal.id,
      dni: nuevoPersonal.dni,
      nombre: nuevoPersonal.nombre,
      apellido: nuevoPersonal.apellido,
      regimen_laboral: nuevoPersonal.regimen_laboral,
      ue: nuevoPersonal.ue,
      dependencia: nuevoPersonal.dependencia,
      email: nuevoPersonal.email,
      fechaIngreso: nuevoPersonal.fechaIngreso,
    };
    // Guardar personal en servidor
    async function guardarPersonal() {
      try {
        console.log("Payload registro personal:", payload);
        await apiFetch("/api/personal", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        const cronogramasIniciales = generarCronogramasVacacionales(
          nuevoPersonal.fechaIngreso,
          nuevoPersonal.id,
        );

        for (const cronograma of cronogramasIniciales) {
          await apiFetch("/api/schedules", {
            method: "POST",
            body: JSON.stringify(cronograma),
          });
        }

        const updatedPersonal = [...personal, nuevoPersonal];
        setPersonal(updatedPersonal);
        toast.success(
          cronogramasIniciales.length > 0
            ? `Personal ${formData.nombre} ${formData.apellido} registrado. Se crearon ${cronogramasIniciales.length} cronogramas.`
            : `Personal ${formData.nombre} ${formData.apellido} registrado exitosamente`,
        );
        // Limpiar formulario
        setFormData({
          dni: "",
          nombre: "",
          apellido: "",
          regimen_laboral: "",
          ue: "",
          dependencia: "",
          email: "",
          fechaIngreso: "",
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

  const handleImportExcelPersonal = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = new Uint8Array(await file.arrayBuffer());
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      const importados: Personal[] = [];
      let cronogramasCreados = 0;

      for (const row of rows) {
        const get = (keys: string[]) => {
          for (const k of keys) {
            if (
              row[k] !== undefined &&
              row[k] !== null &&
              String(row[k]).trim() !== ""
            ) {
              return String(row[k]).trim();
            }
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
        const fechaIngresoRaw = get([
          "fechaIngreso",
          "fecha_ingreso",
          "FechaIngreso",
          "Fecha de Ingreso",
          "fecha de ingreso",
        ]);
        const fechaIngreso = parseExcelDateValue(fechaIngresoRaw);
        const dni = get(["dni", "DNI"]);
        const regimen_laboral = get([
          "regimen_laboral",
          "RegimenLaboral",
          "Regimen Laboral",
          "régimen laboral",
        ]);
        const ue = get(["ue", "UE", "u.e.", "U.E."]);
        const dependencia = get([
          "dependencia",
          "Dependencia",
          "DEPENDENCIA",
        ]);
        const email = get(["email", "Email", "EMAIL"]);

        if (!nombre || !apellido || !dni || !fechaIngreso) {
          continue;
        }

        const id = get(["id", "ID"]) || generateUuid();
        const personalImportado: Personal = {
          id,
          dni,
          nombre,
          apellido,
          regimen_laboral,
          ue,
          dependencia,
          email,
          fechaIngreso,
        };

        const payload = {
          id: personalImportado.id,
          dni: personalImportado.dni,
          nombre: personalImportado.nombre,
          apellido: personalImportado.apellido,
          regimen_laboral: personalImportado.regimen_laboral,
          ue: personalImportado.ue,
          dependencia: personalImportado.dependencia,
          email: personalImportado.email,
          fechaIngreso: personalImportado.fechaIngreso,
        };

        await apiFetch("/api/personal", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        const cronogramasIniciales = generarCronogramasVacacionales(
          personalImportado.fechaIngreso,
          personalImportado.id,
        );

        for (const cronograma of cronogramasIniciales) {
          await apiFetch("/api/schedules", {
            method: "POST",
            body: JSON.stringify(cronograma),
          });
        }

        importados.push(personalImportado);
        cronogramasCreados += cronogramasIniciales.length;
      }

      if (importados.length > 0) {
        setPersonal((prev) => {
          const next = [...prev, ...importados];
          localStorage.setItem("personal", JSON.stringify(next));
          return next;
        });
      }

      toast.success(
        importados.length > 0
          ? `Se importaron ${importados.length} empleados y se crearon ${cronogramasCreados} cronogramas.`
          : "No se encontraron registros válidos para importar",
      );
    } catch (err) {
      toast.error("Error al importar el archivo Excel");
    }

    e.currentTarget.value = "";
  };
  
  /*
  const limpiarDatos = async () => {
    try {
      ocalStorage.removeItem("personal");
      localStorage.removeItem("cronogramas");
      await apiFetch("/api/personal", { method: "DELETE" });
      setPersonal([]);
      toast.success("Datos de personal limpiados");
    } catch (err) {
      toast.error("Error limpiando datos");
    }
  };
  */

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

            <div className="ml-auto flex gap-2 flex-wrap">
              <Button
                onClick={exportarPersonalJSON}
                variant="outline"
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Exp. (JSON)
              </Button>

              <Button
                onClick={() => fileExcelRef.current?.click()}
                variant="outline"
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Imp. Per. (Excel)
              </Button>

              {/*TODO: Agregar confirmación antes de limpiar datos
              <Button
                onClick={limpiarDatos}
                variant="destructive"
                className="gap-2">Limpiar Datos
              </Button>*/}

            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 overflow-x-hidden">
        <input
          ref={fileExcelRef}
          type="file"
          accept=".xlsx, .xls"
          onChange={handleImportExcelPersonal}
          style={{ display: "none" }}
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Formulario de Registro */}
          <Card className="min-w-0">
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
                    <Label htmlFor="dni">DNI</Label>
                    <Input
                      id="dni"
                      placeholder="Ingrese el DNI"
                      value={formData.dni}
                      onChange={(e) =>
                        setFormData({ ...formData, dni: e.target.value })
                      }
                    />
                  </div>
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

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="regimen_laboral">Régimen Laboral</Label>
                    <Input
                      id="regimen_laboral"
                      placeholder="Ingrese el régimen laboral"
                      value={formData.regimen_laboral}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          regimen_laboral: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ue">UE</Label>
                    <Input
                      id="ue"
                      placeholder="Ingrese la UE"
                      value={formData.ue}
                      onChange={(e) =>
                        setFormData({ ...formData, ue: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dependencia">Dependencia</Label>
                  <Input
                    id="dependencia"
                    placeholder="Ingrese la dependencia"
                    value={formData.dependencia}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        dependencia: e.target.value,
                      })
                    }
                  />
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
          <Card className="min-w-0">
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
                <div className="w-full overflow-x-auto">
                  <Table className="min-w-[960px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>DNI</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Régimen</TableHead>
                        <TableHead>UE</TableHead>
                        <TableHead>Dependencia</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Ingreso</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {personal.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{p.dni}</TableCell>
                          <TableCell className="font-medium">
                            {p.nombre} {p.apellido}
                          </TableCell>
                          <TableCell>{p.regimen_laboral}</TableCell>
                          <TableCell>{p.ue}</TableCell>
                          <TableCell>{p.dependencia}</TableCell>
                          <TableCell>{p.email}</TableCell>
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
