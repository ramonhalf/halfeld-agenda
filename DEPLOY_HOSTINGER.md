# Guia de Deploy - Hostinger VPS

Este guia fornece instruções passo a passo para fazer o deploy da aplicação Halfeld PetCare Agenda no Hostinger VPS.

## Pré-requisitos

- ✅ Conta Hostinger com VPS ativo
- ✅ Acesso SSH ao VPS
- ✅ Domínio configurado (opcional mas recomendado)

## Parte 1: Preparação Local

### 1. Teste Local Antes do Deploy

```bash
# Certifique-se de que tudo está funcionando
npm install
npm start

# Teste em http://localhost:3000
# Verifique login, agendamentos, clientes, etc.
```

### 2. Gerar Chave de Sessão Segura

No Windows PowerShell:
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

Ou Node.js:
```javascript
require('crypto').randomBytes(32).toString('hex')
```

Salve esta chave para usar no servidor!

---

## Parte 2: Configuração do Servidor VPS

### 1. Conectar via SSH

```bash
ssh root@seu-ip-vps-hostinger.com
# Ou use o usuário fornecido pelo Hostinger
```

### 2. Atualizar Sistema

```bash
sudo apt update && sudo apt upgrade -y
```

### 3. Instalar Node.js

```bash
# Instalar Node.js 18.x LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar instalação
node --version
npm --version
```

### 4. Instalar PM2 (Process Manager)

```bash
sudo npm install -g pm2
```

### 5. Criar Usuário para Aplicação (Segurança)

```bash
sudo adduser halfeld
sudo usermod -aG sudo halfeld
su - halfeld
```

---

## Parte 3: Upload da Aplicação

### Opção A: Via Git (Recomendado)

```bash
cd ~
git clone https://github.com/seu-usuario/halfeld-agenda.git
cd halfeld-agenda
```

### Opção B: Via SFTP/SCP

Use FileZilla ou WinSCP para enviar arquivos:
- Host: seu-ip-vps
- Port: 22
- Protocolo: SFTP
- Enviar toda a pasta EXCETO: `node_modules/`, `backups/`, `*.backup*`, `.env`

---

## Parte 4: Configuração da Aplicação

### 1. Instalar Dependências

```bash
cd ~/halfeld-agenda
npm install --production
```

### 2. Configurar Variáveis de Ambiente

```bash
cp .env.example .env
nano .env
```

Edite com suas configurações:
```env
PORT=3000
NODE_ENV=production
SESSION_SECRET=sua-chave-gerada-de-32-caracteres-aqui
DATABASE_PATH=./halfeld_agenda.db
```

Salve: `Ctrl+O`, Enter, `Ctrl+X`

### 3. Iniciar com PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
# Copie e execute o comando que aparecer
```

### 4. Verificar Status

```bash
pm2 status
pm2 logs halfeld-agenda
```

---

## Parte 5: Configurar Nginx (Proxy Reverso)

### 1. Instalar Nginx

```bash
sudo apt install nginx -y
```

### 2. Criar Configuração

```bash
sudo nano /etc/nginx/sites-available/halfeld-agenda
```

Cole este conteúdo (substitua `seu-dominio.com`):

```nginx
server {
    listen 80;
    server_name seu-dominio.com www.seu-dominio.com;

    # Logs
    access_log /var/log/nginx/halfeld-access.log;
    error_log /var/log/nginx/halfeld-error.log;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # Headers importantes
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

### 3. Ativar Site

```bash
sudo ln -s /etc/nginx/sites-available/halfeld-agenda /etc/nginx/sites-enabled/
sudo nginx -t  # Testar configuração
sudo systemctl restart nginx
```

### 4. Configurar Firewall

```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

---

## Parte 6: Configurar SSL (HTTPS)

### 1. Instalar Certbot

```bash
sudo apt install certbot python3-certbot-nginx -y
```

### 2. Obter Certificado SSL

```bash
sudo certbot --nginx -d seu-dominio.com -d www.seu-dominio.com
```

Siga as instruções:
- Digite seu email
- Aceite os termos
- Escolha "redirect" (opção 2) para forçar HTTPS

### 3. Testar Renovação Automática

```bash
sudo certbot renew --dry-run
```

---

## Parte 7: Backup Automático

### 1. Criar Script de Backup

```bash
mkdir -p ~/backups
nano ~/backup-db.sh
```

Cole:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
cp ~/halfeld-agenda/halfeld_agenda.db ~/backups/halfeld_$DATE.db
# Manter apenas últimos 30 backups
ls -t ~/backups/halfeld_*.db | tail -n +31 | xargs -r rm
```

Dar permissão:
```bash
chmod +x ~/backup-db.sh
```

### 2. Agendar Backup Diário

```bash
crontab -e
```

Adicione (backup às 3h da manhã):
```
0 3 * * * /home/halfeld/backup-db.sh
```

---

## Comandos Úteis PM2

```bash
# Ver status
pm2 status

# Ver logs em tempo real
pm2 logs halfeld-agenda

# Restart
pm2 restart halfeld-agenda

# Stop
pm2 stop halfeld-agenda

# Monitoramento
pm2 monit

# Limpar logs
pm2 flush
```

---

## Checklist Final

Após deploy, teste:

- [ ] Aplicação acessível via domínio
- [ ] HTTPS funcionando (cadeado verde)
- [ ] Login funciona
- [ ] Criar/editar/excluir agendamento
- [ ] WebSocket em tempo real (abra 2 abas e teste)
- [ ] Upload de clientes
- [ ] Relatórios financeiros
- [ ] Módulo de usuários (se admin)

---

## Troubleshooting

### Aplicação não inicia

```bash
pm2 logs halfeld-agenda --lines 50
```

### Nginx retorna 502 Bad Gateway

```bash
# Verificar se app está rodando
pm2 status

# Verificar logs do Nginx
sudo tail -f /var/log/nginx/halfeld-error.log
```

### WebSocket não conecta

- Verifique configuração Nginx (headers Upgrade e Connection)
- Certifique-se de que firewall permite portas 80 e 443

### Banco de dados corrompido

```bash
# Restaurar backup mais recente
cp ~/backups/halfeld_XXXXXXXX.db ~/halfeld-agenda/halfeld_agenda.db
pm2 restart halfeld-agenda
```

---

## Suporte

- **Hostinger**: https://www.hostinger.com.br/tutoriais/
- **PM2**: https://pm2.keymetrics.io/docs/
- **Nginx**: https://nginx.org/en/docs/
- **Certbot**: https://certbot.eff.org/

---

## Atualizações Futuras

Para atualizar a aplicação:

```bash
cd ~/halfeld-agenda

# Backup do banco antes!
cp halfeld_agenda.db halfeld_agenda.db.backup

# Pull novidades (se via Git)
git pull origin main

# Ou faça upload dos arquivos novos via SFTP

# Reinstalar dependências se necessário
npm install --production

# Restart
pm2 restart halfeld-agenda
```

---

✅ **Deploy concluído com sucesso!**
