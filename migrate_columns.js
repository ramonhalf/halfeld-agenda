const { Pool } = require('pg');

const connectionString = 'postgresql://postgres.rsaaryrgdrolcsvigckz:Neanderthal46$Iturguer@aws-0-us-west-2.pooler.supabase.com:6543/postgres';

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    const client = await pool.connect();

    try {
        console.log('🔧 Conectando ao banco de dados...\n');

        // Adicionar coluna cliente_pacote_id
        console.log('📋 Verificando coluna cliente_pacote_id...');
        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name='agendamentos' AND column_name='cliente_pacote_id'
                ) THEN
                    ALTER TABLE agendamentos ADD COLUMN cliente_pacote_id INTEGER REFERENCES clientes_pacotes(id);
                    RAISE NOTICE 'Coluna cliente_pacote_id criada com sucesso';
                ELSE
                    RAISE NOTICE 'Coluna cliente_pacote_id já existe';
                END IF;
            END $$;
        `);
        console.log('✅ Coluna cliente_pacote_id verificada\n');

        // Adicionar coluna sem_custo
        console.log('📋 Verificando coluna sem_custo...');
        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name='agendamentos' AND column_name='sem_custo'
                ) THEN
                    ALTER TABLE agendamentos ADD COLUMN sem_custo BOOLEAN DEFAULT FALSE;
                    RAISE NOTICE 'Coluna sem_custo criada com sucesso';
                ELSE
                    RAISE NOTICE 'Coluna sem_custo já existe';
                END IF;
            END $$;
        `);
        console.log('✅ Coluna sem_custo verificada\n');

        // Verificar se as colunas foram criadas
        console.log('🔍 Verificando colunas criadas...');
        const result = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name='agendamentos' 
              AND column_name IN ('cliente_pacote_id', 'sem_custo')
            ORDER BY column_name;
        `);

        console.log('\n✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!\n');
        console.log('Colunas na tabela agendamentos:');
        console.table(result.rows);

        console.log('\n🎉 Todas as colunas foram adicionadas com sucesso!');
        console.log('📝 Você pode agora reiniciar o servidor e fazer novos agendamentos.');

    } catch (error) {
        console.error('❌ Erro durante a migração:', error.message);
        console.error(error);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
