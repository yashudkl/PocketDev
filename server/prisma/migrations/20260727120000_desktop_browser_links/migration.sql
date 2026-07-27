-- Track the connected machine and every project folder exposed by its desktop agent.
ALTER TABLE "desktop_presence"
ADD COLUMN "deviceName" TEXT,
ADD COLUMN "linkedProjects" JSONB;
