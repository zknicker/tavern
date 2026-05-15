import { getClaudeUsage } from './index.ts';

const usage = await getClaudeUsage();
console.log(JSON.stringify(usage, null, 2));
