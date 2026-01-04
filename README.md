# 🐾 Halfeld PetCare - Sistema de Agendamento v2.0

Sistema de agendamento em tempo real com autenticação e acesso remoto para banho e tosa.

## ✨ Novidades v2.0

- 🔒 **Autenticação segura** - Login obrigatório com senhas criptografadas
- 👥 **Multi-usuários** - Admin + funcionários com permissões diferentes
- 💰 **Financeiro protegido** - Apenas administradores têm acesso
- 🌐 **Acesso remoto** - Use de qualquer lugar (celular, tablet, outro PC)
- ☁️ **Deploy em nuvem** - Pronto para Render ou Railway

## 🚀 Início Rápido

### 1. Instalar Dependências (primeira vez)

```powershell
npm install
```

### 2. Iniciar Servidor

**Opção A - Com o script:**
```powershell
.\start-server.bat
```

**Opção B - Manual:**
```powershell
npm start
```

### 3. Acessar o Sistema

Abra o navegador em: **http://localhost:3000**

**Login padrão:**
- **Usuário**: `admin`
- **Senha**: `halfeld2025`

## 📱 Acesso Remoto

### Mesma Rede WiFi (Celular/Tablet)

1. Descubra o IP do PC:
   ```powershell
   ipconfig
   ```
   Procure por "IPv4" (ex: 192.168.1.10)

2. No celular, acesse:
   ```
   http://192.168.1.10:3000
   ```

3. Faça login com as mesmas credenciais

### Via Internet (Qualquer Lugar)

Veja instruções completas em: **[ACESSO_REMOTO_COMPLETO.md](./ACESSO_REMOTO_COMPLETO.md)**

**Opções:**
- **Render** - Grátis (para testes)
- **Railway** - $5/mês (produção, sempre online)

## 👥 Gerenciamento de Usuários

### Permissões

| Recurso | Funcionário | Admin |
|---------|-------------|-------|
| Agendamentos | ✅ | ✅ |
| Catálogo | ✅ | ✅ |
| **Financeiro** | ❌ | ✅ |
| **Criar usuários** | ❌ | ✅ |

### Criar Novo Usuário

Como admin, use a API no console do navegador:

```javascript
fetch('/api/usuarios', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        username: 'maria',
        password: 'senha123',
        nomeCompleto: 'Maria Silva',
        isAdmin: false  // true para admin
    })
});
```

### Trocar Senha

```javascript
fetch('/api/auth/change-password', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        currentPassword: 'senha_atual',
        newPassword: 'nova_senha'
    })
});
```

## 🔧 Configuração

### Variáveis de Ambiente

Edite `.env` para personalizar:

```env
PORT=3000
NODE_ENV=development
SESSION_SECRET=sua_chave_secreta_aqui
```

**⚠️ IMPORTANTE em produção:**
- Mude `SESSION_SECRET` para valor aleatório
- Configure `NODE_ENV=production`

## 📊 Funcionalidades

✅ Timeline visual com blocos de 15 minutos  
✅ Sincronização em tempo real via WebSocket  
✅ Taxi Dog com alarmes 15min antes  
✅ Catálogo editável de serviços  
✅ Sistema de pagamentos (pago/a receber)  
✅ Relatórios financeiros (apenas admin)  
✅ Valores editáveis por agendamento  
✅ Serviços extras ilimitados  
✅ Sistema de descontos (R$ ou %)  

## 🔐 Segurança

- Senhas criptografadas com bcrypt
- Sessões seguras com cookies httpOnly
- Rate limiting (100 req/15min)
- Proteção CSRF
- Headers de segurança (Helmet)
- HTTPS em produção

## 📁 Estrutura

```
App Repository/
├── server.js           # Servidor backend com auth
├── database.js         # Banco de dados + usuários
├── auth.js             # Módulo de autenticação
├── package.json        # Dependências
├── .env                # Configuração local
├── index.html          # App principal (protegido)
├── login.html          # Página de login
├── styles.css          # Estilos do app
├── login.css           # Estilos do login
├── app.js              # Lógica frontend
├── data.js             # Configurações e utils
├── halfeld_agenda.db   # Banco SQLite
├── start-server.bat    # Script para iniciar
└── Logo/               # Logos da marca
```

## 🆘 Solução de Problemas

### Servidor não inicia
- Verifique Node.js instalado: `node --version`
- Rode: `npm install`
- Confira se porta 3000 está livre

### Não consigo fazer login
- Usuário padrão: `admin` / `halfeld2025`
- Se esqueceu senha, delete `halfeld_agenda.db` e reinicie (CUIDADO: apaga tudo!)

### Não sincroniza entre dispositivos
- Mesma rede WiFi
- Firewall liberado para porta 3000
- WebSocket está conectado (veja console)

### Erro 401 Unauthorized
- Faça login novamente
- Limpe cookies do navegador
- Sessão pode ter expirado (24h)

## 📚 Documentação Adicional

- **[ACESSO_REMOTO_COMPLETO.md](./ACESSO_REMOTO_COMPLETO.md)** - Guia completo de acesso remoto e deploy
- **[Walkthrough](C:\Users\Bruna PetCare\.gemini\antigravity\brain\b6ee6af7-bd58-4d94-ab8a-dc821ccf3303\walkthrough.md)** - Documentação técnica das mudanças

## 🔄 Backup

**Fazer backup:**
```powershell
copy halfeld_agenda.db halfeld_agenda_backup_2025-12-15.db
```

**Restaurar backup:**
```powershell
copy halfeld_agenda_backup_2025-12-15.db halfeld_agenda.db
```

## 📞 Suporte

Para dúvidas técnicas, consulte a documentação ou contate o desenvolvedor.

---

**Desenvolvido para Halfeld PetCare** 🐾✨  
**Versão 2.0.0** - Sistema com Autenticação e Acesso Remoto
