import { getDb, closeDb } from '../db/index.js';
import { ensureSeedData } from './seedFn.js';

getDb();
ensureSeedData();
console.log('Seed complete.');
closeDb();
