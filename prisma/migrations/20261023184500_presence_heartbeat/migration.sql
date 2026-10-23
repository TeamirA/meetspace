-- AlterTable
ALTER TABLE "meetings" ADD COLUMN     "e2ee_media" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "participants" ADD COLUMN     "hand_raised_at" TIMESTAMPTZ(3),
ADD COLUMN     "last_seen_at" TIMESTAMPTZ(3);

