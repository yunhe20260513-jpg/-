ALTER TABLE "Signal" ADD COLUMN "priorityScore" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Signal_priorityScore_idx" ON "Signal"("priorityScore");
