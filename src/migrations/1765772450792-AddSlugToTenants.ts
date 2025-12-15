import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSlugToTenants1765772450792 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "tenants" 
            ADD COLUMN "slug" character varying,
            ADD CONSTRAINT "UQ_tenants_slug" UNIQUE ("slug")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "tenants" 
            DROP CONSTRAINT "UQ_tenants_slug",
            DROP COLUMN "slug"
        `);
  }
}
