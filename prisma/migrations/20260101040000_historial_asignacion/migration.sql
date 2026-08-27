-- CreateTable
CREATE TABLE "HistorialAsignacion" (
    "id" TEXT NOT NULL,
    "equipoFolio" TEXT NOT NULL,
    "empleadoIdAnterior" TEXT,
    "empleadoIdNuevo" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "realizadoPor" TEXT,

    CONSTRAINT "HistorialAsignacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HistorialAsignacion_equipoFolio_idx" ON "HistorialAsignacion"("equipoFolio");
