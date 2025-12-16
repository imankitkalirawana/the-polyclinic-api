import { MigrationInterface, QueryRunner } from 'typeorm';

export class OtpTable1765853164558 implements MigrationInterface {
  name = 'OtpTable1765853164558';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_57de40bc620f456c7311aa3a1e"`,
    );
    await queryRunner.query(
      `CREATE TABLE "otps" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "code" character varying NOT NULL, "verified" boolean NOT NULL DEFAULT false, "expiresAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_91fef5ed60605b854a2115d2410" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2afebf0234962331e12c59c592" ON "otps" ("expiresAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a1a32e0358e00377e99f3199cd" ON "otps" ("email", "verified") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1c1ba87aeebfed70e373e7ee64" ON "otps" ("email", "code") `,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "phone"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "image"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "organizationSlug"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sessions" DROP CONSTRAINT "PK_ba57f8421edf5e5c4e99b833811"`,
    );
    await queryRunner.query(`ALTER TABLE "sessions" DROP COLUMN "sessionId"`);
    await queryRunner.query(`ALTER TABLE "sessions" DROP COLUMN "ipAddress"`);
    await queryRunner.query(`ALTER TABLE "sessions" DROP COLUMN "userAgent"`);
    await queryRunner.query(`ALTER TABLE "sessions" DROP COLUMN "updatedAt"`);
    await queryRunner.query(
      `ALTER TABLE "sessions" ADD "id" uuid NOT NULL DEFAULT uuid_generate_v4()`,
    );
    await queryRunner.query(
      `ALTER TABLE "sessions" ADD CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY ("id")`,
    );
    // Delete existing sessions since we're restructuring the table
    // Existing sessions won't have valid tokens for the new structure
    await queryRunner.query(`DELETE FROM "sessions"`);
    await queryRunner.query(
      `ALTER TABLE "sessions" ADD "token" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "id"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "id" uuid NOT NULL DEFAULT uuid_generate_v4()`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'OPS'`,
    );
    await queryRunner.query(`ALTER TABLE "sessions" DROP COLUMN "userId"`);
    await queryRunner.query(
      `ALTER TABLE "sessions" ADD "userId" uuid NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_50762206f116cd47d1c3fec396" ON "sessions" ("expiresAt") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_e9f62f5dcb8a54b84234c9e7a0" ON "sessions" ("token") `,
    );
    await queryRunner.query(
      `ALTER TABLE "sessions" ADD CONSTRAINT "FK_57de40bc620f456c7311aa3a1e6" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sessions" DROP CONSTRAINT "FK_57de40bc620f456c7311aa3a1e6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e9f62f5dcb8a54b84234c9e7a0"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_50762206f116cd47d1c3fec396"`,
    );
    await queryRunner.query(`ALTER TABLE "sessions" DROP COLUMN "userId"`);
    await queryRunner.query(
      `ALTER TABLE "sessions" ADD "userId" integer NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'PATIENT'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "id"`);
    await queryRunner.query(`ALTER TABLE "users" ADD "id" SERIAL NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")`,
    );
    await queryRunner.query(`ALTER TABLE "sessions" DROP COLUMN "token"`);
    await queryRunner.query(
      `ALTER TABLE "sessions" DROP CONSTRAINT "PK_3238ef96f18b355b671619111bc"`,
    );
    await queryRunner.query(`ALTER TABLE "sessions" DROP COLUMN "id"`);
    await queryRunner.query(
      `ALTER TABLE "sessions" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "sessions" ADD "userAgent" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "sessions" ADD "ipAddress" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "sessions" ADD "sessionId" uuid NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "sessions" ADD CONSTRAINT "PK_ba57f8421edf5e5c4e99b833811" PRIMARY KEY ("sessionId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "organizationSlug" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "image" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "phone" character varying`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1c1ba87aeebfed70e373e7ee64"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a1a32e0358e00377e99f3199cd"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2afebf0234962331e12c59c592"`,
    );
    await queryRunner.query(`DROP TABLE "otps"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_57de40bc620f456c7311aa3a1e" ON "sessions" ("userId") `,
    );
  }
}
