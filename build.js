const fs = require('fs');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error('❌ ERRO: Variáveis de ambiente SUPABASE_URL ou SUPABASE_KEY não encontradas!');
}

const configContent = `// Configurações geradas automaticamente pelo Build do Vercel
const CONFIG = {
    SUPABASE_URL: ${JSON.stringify(process.env.SUPABASE_URL || '')},
    SUPABASE_KEY: ${JSON.stringify(process.env.SUPABASE_KEY || '')},
    ADMIN_PASSWORD: ${JSON.stringify(process.env.ADMIN_PASSWORD || 'anaevictor2024')}
};
`;

fs.writeFileSync('config.js', configContent);
console.log('✅ config.js gerado com sucesso a partir das variáveis de ambiente.');
