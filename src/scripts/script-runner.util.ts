// src/scripts/script-runner.util.ts
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { INestApplicationContext } from '@nestjs/common';
import { AppModule } from '../app.module';

/**
 * Utility function to run scripts with NestJS application context
 * Handles initialization, execution, and cleanup automatically
 *
 * @param scriptFn Function that receives the NestJS application context
 * @returns Promise that resolves when script completes
 */
export async function runScript<T = void>(
  scriptFn: (app: INestApplicationContext) => Promise<T>,
): Promise<T> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    return await scriptFn(app);
  } catch (err) {
    console.error('\n❌ Script failed:', err);
    throw err;
  } finally {
    await app.close();
  }
}

/**
 * Wrapper to run a script and handle process exit codes
 * Use this as the entry point for your script files
 *
 * @param scriptFn Function that receives the NestJS application context
 */
export async function executeScript(
  scriptFn: (app: INestApplicationContext) => Promise<void>,
): Promise<void> {
  try {
    await runScript(scriptFn);
    process.exit(0);
  } catch {
    // Error already logged in runScript
    process.exit(1);
  }
}
