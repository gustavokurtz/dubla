-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "situacao" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL,
    "iniciadoEm" TIMESTAMP(3),
    "terminadoEm" TIMESTAMP(3),
    "erro" TEXT,
    "etapaDoErro" TEXT,
    "arquivo" TEXT,
    "custoTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Etapa" (
    "jobId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3),
    "feito" INTEGER,
    "total" INTEGER,
    "erro" TEXT,
    "custo" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Etapa_pkey" PRIMARY KEY ("jobId","ordem")
);

-- CreateTable
CREATE TABLE "Chamada" (
    "jobId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "etapa" INTEGER,
    "servico" TEXT NOT NULL,
    "papel" TEXT,
    "modelo" TEXT,
    "entrada" INTEGER,
    "saida" INTEGER,
    "segundos" DOUBLE PRECISION,
    "caracteres" INTEGER,
    "quantidade" INTEGER,
    "custo" DOUBLE PRECISION NOT NULL,
    "duracaoMs" INTEGER NOT NULL,

    CONSTRAINT "Chamada_pkey" PRIMARY KEY ("jobId","ordem")
);

-- AddForeignKey
ALTER TABLE "Etapa" ADD CONSTRAINT "Etapa_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chamada" ADD CONSTRAINT "Chamada_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
