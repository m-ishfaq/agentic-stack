import { lineCount } from './util.js';

export function render(text, vars) {
  return text.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, key) => {
    const value = key.split('.').reduce((acc, part) => (acc == null ? acc : acc[part]), vars);
    return value == null ? match : String(value);
  });
}

export function unreplacedKeys(text) {
  return [...text.matchAll(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g)].map((m) => m[1]);
}

export function budgetProblems(files, budgets = {}) {
  const problems = [];
  for (const file of files) {
    const lines = lineCount(file.content);
    if (file.path === 'AGENTS.md' && budgets.agentsMdLines && lines > budgets.agentsMdLines) {
      problems.push(`AGENTS.md is ${lines} lines, budget is ${budgets.agentsMdLines}`);
    }
    if (file.path.startsWith('.agents/rules/') && budgets.ruleLines && lines > budgets.ruleLines) {
      problems.push(`${file.path} is ${lines} lines, budget is ${budgets.ruleLines}`);
    }
    const leftover = unreplacedKeys(file.content);
    if (leftover.length > 0) {
      problems.push(`${file.path} has unresolved placeholders: ${leftover.join(', ')}`);
    }
  }
  return problems;
}
