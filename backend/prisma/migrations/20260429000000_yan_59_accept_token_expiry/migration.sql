-- Yan #59: track accept-link usage + TTL so a leaked acceptToken can no
-- longer toggle status forever. acceptedAt records the first redemption;
-- acceptTokenExpires is set at create time (default 48h via app code).

-- AlterTable
ALTER TABLE "staff_assignments" ADD COLUMN "acceptedAt" DATETIME;
ALTER TABLE "staff_assignments" ADD COLUMN "acceptTokenExpires" DATETIME;
