# Changelog - Halfeld PetCare

## v2.0.0 - 2025-12-15

### 🚀 Principais Mudanças

**Autenticação e Segurança**
- ✅ Sistema completo de login/logout
- ✅ Senhas criptografadas com bcrypt
- ✅ Sessões seguras com express-session
- ✅ Proteção de todas as rotas da API
- ✅ Rate limiting (100 req/15min)
- ✅ Headers de segurança com Helmet

**Multi-Usuários**
- ✅ Sistema de permissões (Admin/Funcionário)
- ✅ Usuário admin criado automaticamente
- ✅ Financeiro restrito apenas para admin
- ✅ API para criar/gerenciar usuários

**Acesso Remoto**
- ✅ URLs dinâmicas (funciona local e cloud)
- ✅ WebSocket adaptativo (ws/wss)
- ✅ Configuração para Render.com
- ✅ Configuração para Railway.app
- ✅ Documentação completa de deploy

**Limpeza de Código**
- ✅ Removidos 10 arquivos obsoletos
- ✅ Documentação consolidada
- ✅ Código integrado (app_mini_modal.js)

**Novas Dependências**
- `bcrypt` - Hash de senhas
- `dotenv` - Variáveis de ambiente
- `express-session` - Gerenciamento de sessões
- `helmet` - Segurança HTTP
- `express-rate-limit` - Rate limiting

**Arquivos Criados**
- `auth.js` - Módulo de autenticação
- `login.html` - Página de login
- `login.css` - Estilos do login
- `.env` / `.env.example` - Configuração
- `.gitignore` - Proteção de arquivos
- `railway.json` - Config deploy Railway
- `start-server.bat` - Script de início
- `ACESSO_REMOTO_COMPLETO.md` - Guia completo

**Arquivos Modificados**
- `server.js` - Reescrito com auth e segurança
- `database.js` - Tabela usuarios + funções
- `app.js` - Verificação auth + logout
- `data.js` - URLs dinâmicas
- `index.html` - Info usuário + botão sair
- `package.json` - v2.0.0 + novas deps
- `README.md` - Documentação v2.0

**Arquivos Removidos**
- `app_backup.js`
- `app_mini_modal.js`
- `excluir_servico_function.txt`
- `MODIFICACOES.md`
- `MODIFICACOES_ADICIONAIS.md`
- `SISTEMA_PAGAMENTOS.md`
- `CORRECOES_BUGS.md`
- `SOLUCAO_RAPIDA.md`
- `ACESSO_REMOTO.md`
- `ACESSO_INTERNET.md`

### 🔐 Credenciais Padrão

**Login inicial:**
- Username: `admin`
- Password: `halfeld2025`

### ⚠️ Breaking Changes

- **Login obrigatório**: Não é mais possível acessar sem autenticação
- **Financeiro restrito**: Apenas usuários admin podem acessar relatórios
- **Novas dependências**: Execute `npm install` para atualizar

### 📝 Notas de Migração

Se você está atualizando da v1.0:

1. Faça backup do banco de dados:
   ```
   copy halfeld_agenda.db halfeld_agenda_backup.db
   ```

2. Instale novas dependências:
   ```
   npm install
   ```

3. Reinicie o servidor:
   ```
   npm start
   ```

4. Faça login com credenciais padrão
5. Crie usuários para sua equipe

---

## v1.0.0 - 2025-12-14

### Funcionalidades Iniciais

- Timeline visual com blocos de 15 minutos
- Sincronização em tempo real via WebSocket
- Sistema Taxi Dog com alarmes
- Catálogo de serviços editável
- Sistema de pagamentos
- Relatórios financeiros
- Valores editáveis por agendamento
- Serviços extras
- Sistema de descontos
