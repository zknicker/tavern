import { getCodexUsage } from './index.ts';

const usage = await getCodexUsage();
console.log(JSON.stringify(usage, null, 2));
