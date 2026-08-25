-- AlterTable
ALTER TABLE "Equipo" ADD COLUMN "fechaDevolucionEsperada" TIMESTAMP(3);
ALTER TABLE "Equipo" ADD COLUMN "correoPrestamoVencidoEnviado" BOOLEAN NOT NULL DEFAULT false;
