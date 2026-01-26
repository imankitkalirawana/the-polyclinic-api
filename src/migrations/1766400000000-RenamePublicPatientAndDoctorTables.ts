import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenamePublicPatientAndDoctorTables1766400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Patients
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'patients'
        ) AND NOT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'patient_patients'
        ) THEN
          ALTER TABLE "public"."patients" RENAME TO "patient_patients";
        END IF;
      END $$;
    `);

    // Doctors
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'doctors'
        ) AND NOT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'doctor_doctors'
        ) THEN
          ALTER TABLE "public"."doctors" RENAME TO "doctor_doctors";
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Patients
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'patient_patients'
        ) AND NOT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'patients'
        ) THEN
          ALTER TABLE "public"."patient_patients" RENAME TO "patients";
        END IF;
      END $$;
    `);

    // Doctors
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'doctor_doctors'
        ) AND NOT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'doctors'
        ) THEN
          ALTER TABLE "public"."doctor_doctors" RENAME TO "doctors";
        END IF;
      END $$;
    `);
  }
}
