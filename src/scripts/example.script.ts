import './types';
import { executeScript } from './script-runner.util';
import { INestApplicationContext } from '@nestjs/common';
import { UsersService } from '../modules/public/users/users.service';

async function run(app: INestApplicationContext) {
  const usersService = app.get(UsersService);

  console.log('Starting backfill...');
  const users = await usersService.findAll({});
  console.log(users);
  console.log('Backfill completed');
}

// Execute the script using the utility
executeScript(run);
