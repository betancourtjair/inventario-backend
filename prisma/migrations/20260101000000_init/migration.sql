-- CreateTable
CREATE TABLE "Empleado" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "departamento" TEXT,
    "puesto" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'Activo',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empleado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipo" (
    "folio" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "subtipo" TEXT,
    "marca" TEXT,
    "modelo" TEXT,
    "serie" TEXT,
    "estado" TEXT NOT NULL,
    "ubicacion" TEXT,
    "nombreEquipo" TEXT,
    "condicion" TEXT,
    "accesorios" TEXT,
    "empleadoId" TEXT,
    "proveedor" TEXT,
    "rfcProveedor" TEXT,
    "numeroFactura" TEXT,
    "fechaFactura" TIMESTAMP(3),
    "fechaInicioUso" TIMESTAMP(3),
    "montoFactura" DOUBLE PRECISION,
    "tasaDepreciacion" DOUBLE PRECISION,
    "garantiaMeses" INTEGER,
    "notas" TEXT,
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipo_pkey" PRIMARY KEY ("folio")
);

-- CreateTable
CREATE TABLE "Foto" (
    "id" TEXT NOT NULL,
    "equipoFolio" TEXT NOT NULL,
    "dataBase64" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Foto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Responsiva" (
    "id" TEXT NOT NULL,
    "folioResponsiva" TEXT NOT NULL,
    "equipoFolio" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "htmlSnapshot" TEXT NOT NULL,
    "correoEnviado" BOOLEAN NOT NULL DEFAULT false,
    "correoError" TEXT,
    "generadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Responsiva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LimiteCategoria" (
    "categoria" TEXT NOT NULL,
    "limite" INTEGER NOT NULL,

    CONSTRAINT "LimiteCategoria_pkey" PRIMARY KEY ("categoria")
);

-- CreateTable
CREATE TABLE "LimiteSubtipo" (
    "subtipo" TEXT NOT NULL,
    "limite" INTEGER NOT NULL,

    CONSTRAINT "LimiteSubtipo_pkey" PRIMARY KEY ("subtipo")
);

-- CreateTable
CREATE TABLE "Config" (
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "Config_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "FolioCounter" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "ultimoNumero" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FolioCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'admin',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Responsiva_folioResponsiva_key" ON "Responsiva"("folioResponsiva");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_correo_key" ON "Usuario"("correo");

-- CreateIndex
CREATE INDEX "Equipo_empleadoId_idx" ON "Equipo"("empleadoId");

-- CreateIndex
CREATE INDEX "Foto_equipoFolio_idx" ON "Foto"("equipoFolio");

-- CreateIndex
CREATE INDEX "Responsiva_equipoFolio_idx" ON "Responsiva"("equipoFolio");

-- CreateIndex
CREATE INDEX "Responsiva_empleadoId_idx" ON "Responsiva"("empleadoId");

-- AddForeignKey (si se borra un empleado, sus equipos quedan sin asignar en vez de fallar)
ALTER TABLE "Equipo" ADD CONSTRAINT "Equipo_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey (las fotos no tienen sentido sin su equipo, se borran junto con él)
ALTER TABLE "Foto" ADD CONSTRAINT "Foto_equipoFolio_fkey" FOREIGN KEY ("equipoFolio") REFERENCES "Equipo"("folio") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (protege el historial fiscal/auditoría: no se puede borrar un equipo con responsivas)
ALTER TABLE "Responsiva" ADD CONSTRAINT "Responsiva_equipoFolio_fkey" FOREIGN KEY ("equipoFolio") REFERENCES "Equipo"("folio") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (protege el historial fiscal/auditoría: no se puede borrar un empleado con responsivas)
ALTER TABLE "Responsiva" ADD CONSTRAINT "Responsiva_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
