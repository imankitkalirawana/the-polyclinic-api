import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserTenantsTable1765900000000 implements MigrationInterface {
  name = 'CreateUserTenantsTable1765900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create user_tenants junction table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_tenants" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL,
        "tenantId" UUID NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "FK_user_tenants_userId" FOREIGN KEY ("userId") 
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_tenants_tenantId" FOREIGN KEY ("tenantId") 
          REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_user_tenants_userId_tenantId" UNIQUE ("userId", "tenantId")
      );
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_tenants_userId" ON "user_tenants"("userId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_tenants_tenantId" ON "user_tenants"("tenantId");
    `);

    // Add status, image, phone, deletedAt columns to users table if they don't exist
    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'status'
        ) THEN
          CREATE TYPE status_enum AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
          ALTER TABLE "users" ADD COLUMN "status" status_enum NOT NULL DEFAULT 'ACTIVE';
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'image'
        ) THEN
          ALTER TABLE "users" ADD COLUMN "image" VARCHAR NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'phone'
        ) THEN
          ALTER TABLE "users" ADD COLUMN "phone" VARCHAR NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'deletedAt'
        ) THEN
          ALTER TABLE "users" ADD COLUMN "deletedAt" TIMESTAMP NULL;
        END IF;
      END $$;
    `);

    // Create patients table in public schema if it doesn't exist
    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'patients'
        ) THEN
          CREATE TYPE gender_enum AS ENUM ('MALE', 'FEMALE', 'OTHER');
          CREATE TABLE "patients" (
            "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            "userId" UUID NOT NULL UNIQUE,
            "gender" gender_enum NULL,
            "age" INTEGER NULL,
            "address" VARCHAR NULL,
            "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deletedAt" TIMESTAMP NULL,
            CONSTRAINT "FK_patients_userId" FOREIGN KEY ("userId") 
              REFERENCES "users"("id") ON DELETE CASCADE
          );
        END IF;
      END $$;
    `);

    // Add OTP type to otps table if it doesn't exist
    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'otps' AND column_name = 'type'
        ) THEN
          CREATE TYPE otp_type_enum AS ENUM ('REGISTRATION', 'FORGOT_PASSWORD', 'VERIFICATION');
          ALTER TABLE "otps" ADD COLUMN "type" otp_type_enum NOT NULL DEFAULT 'REGISTRATION';
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_tenants" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "patients" CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS gender_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS status_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS otp_type_enum;`);
  }
}
