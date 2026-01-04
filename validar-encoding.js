const fs = require('fs');
const path = require('path');

const arquivos = [
    'index.html', 'app.js', 'styles.css',
    'pacotes.js', 'gestao.js', 'server.js', 'database.js',
    'taxy.js', 'caixa.js', 'clientes.js', 'usuarios.js', 'financeiro-tabs.js'
];

console.log('=== VALIDACAO DE ENCODING ===\n');

let problemas = 0;

arquivos.forEach(arquivo => {
    const filePath = path.join(__dirname, arquivo);

    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  ${arquivo} - NAO ENCONTRADO`);
        return;
    }

    try {
        const content = fs.readFileSync(filePath, 'utf8');

        // Verificar caracteres problemáticos
        const temProblemas = content.includes('�') ||
            content.match(/\?\?/) ||
            content.includes('Ã§') ||
            content.includes('Ã£');

        if (temProblemas) {
            console.log(`❌ ${arquivo} - ENCODING CORROMPIDO`);
            problemas++;
        } else {
            console.log(`✅ ${arquivo} - OK`);
        }
    } catch (error) {
        console.log(`❌ ${arquivo} - ERRO: ${error.message}`);
        problemas++;
    }
});

console.log('\n' + '='.repeat(40));

if (problemas > 0) {
    console.log(`\n⚠️  ${problemas} arquivo(s) com problemas detectados!`);
    console.log('\n📝 SOLUCAO:');
    console.log('   node limpar-encoding.js');
} else {
    console.log('\n✅ Todos os arquivos estao com encoding correto!');
}
