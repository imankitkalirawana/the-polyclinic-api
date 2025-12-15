import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeSlugRequiredInTenants1765772644956 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // First, ensure all existing records have a slug
    // Generate slugs from names for any null slugs, appending id if needed to ensure uniqueness
    await queryRunner.query(`
      UPDATE "tenants" 
      SET "slug" = CASE 
        WHEN EXISTS (
          SELECT 1 FROM "tenants" t2 
          WHERE t2."id" != "tenants"."id" 
          AND LOWER(REGEXP_REPLACE(t2."name", '[^a-zA-Z0-9]+', '-', 'g')) = LOWER(REGEXP_REPLACE("tenants"."name", '[^a-zA-Z0-9]+', '-', 'g'))
          AND t2."slug" IS NOT NULL
        ) OR EXISTS (
          SELECT 1 FROM "tenants" t3 
          WHERE t3."id" != "tenants"."id" 
          AND LOWER(REGEXP_REPLACE(t3."name", '[^a-zA-Z0-9]+', '-', 'g')) = LOWER(REGEXP_REPLACE("tenants"."name", '[^a-zA-Z0-9]+', '-', 'g'))
          AND t3."slug" IS NULL
        )
        THEN LOWER(REGEXP_REPLACE("name", '[^a-zA-Z0-9]+', '-', 'g')) || '-' || SUBSTRING("id"::text, 1, 8)
        ELSE LOWER(REGEXP_REPLACE("name", '[^a-zA-Z0-9]+', '-', 'g'))
      END
      WHERE "slug" IS NULL
    `);

    // If there are still null slugs (edge case), use id as fallback
    await queryRunner.query(`
      UPDATE "tenants" 
      SET "slug" = "id"::text
      WHERE "slug" IS NULL
    `);

    // Now make the column NOT NULL
    await queryRunner.query(`
      ALTER TABLE "tenants" 
      ALTER COLUMN "slug" SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants" 
      ALTER COLUMN "slug" DROP NOT NULL
    `);
  }
}
