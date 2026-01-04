import fs from 'fs';

let content = fs.readFileSync('c:\\Halfeld PetCare\\Halfeld Agenda\\database.js', 'utf8');

// Remove existing module.exports
content = content.replace(/\n?module\.exports\s*=\s*\{[\s\S]*?\};?\s*$/, '');

// Find all async functions
const matches = content.match(/async function (\w+)/g) || [];
const funcoes = matches.map(m => m.replace('async function ', ''));

// Add initDatabase
if (content.includes('function initDatabase') && !funcoes.includes('initDatabase')) {
    funcoes.unshift('initDatabase');
}

console.log(`Encontradas ${funcoes.length} funções`);

const moduleExports = `
module.exports = {
    ${funcoes.join(',\n    ')}
};
`;

content = content.trim() + '\n' + moduleExports;
fs.writeFileSync('c:\\Halfeld PetCare\\Halfeld Agenda\\database.js', content, 'utf8');

console.log('✅ module.exports atualizado');
