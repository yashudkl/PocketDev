-- Link a desktop agent to the specific PocketDev project and local folder it serves.
ALTER TABLE "projects"
ADD COLUMN "desktopPath" TEXT,
ADD COLUMN "desktopLinkedAt" TIMESTAMP(3);

ALTER TABLE "desktop_presence"
ADD COLUMN "projectId" TEXT,
ADD COLUMN "projectRoot" TEXT;

CREATE INDEX "desktop_presence_projectId_idx" ON "desktop_presence"("projectId");

ALTER TABLE "desktop_presence"
ADD CONSTRAINT "desktop_presence_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "projects"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
