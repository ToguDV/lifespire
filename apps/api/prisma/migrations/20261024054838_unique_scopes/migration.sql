-- DropIndex
DROP INDEX "RecoveryCode_codeHash_key";

-- CreateIndex
CREATE UNIQUE INDEX "Device_userId_name_key" ON "Device"("userId", "name");

-- CreateIndex
CREATE INDEX "RecoveryCode_codeHash_idx" ON "RecoveryCode"("codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryCode_userId_codeHash_key" ON "RecoveryCode"("userId", "codeHash");
