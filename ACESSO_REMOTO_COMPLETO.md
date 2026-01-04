# 🌐 Guia Completo de Acesso Remoto - Halfeld PetCare

Sistema de agendamento acessível de qualquer lugar: celulares, tablets, outros computadores.

---

## 🎯 Opções de Acesso

### 1️⃣ Rede Local (WiFi da empresa)
- ✅ Gratuito
- ✅ Rápido
- ❌ Funciona só na mesma rede WiFi

### 2️⃣ Internet via Render (Recomendado para TESTES)
- ✅ **Gratuito**
- ✅ Acesso de qualquer lugar
- ✅ Fácil configuração
- ⚠️ Suspende após 15 min de inatividade (demora ~30s para ativar)

### 3️⃣ Internet via Railway (~$5/mês - Recomendado PRODUÇÃO)
- ✅ **Sempre online 24/7**
- ✅ Sem espera ou suspensão
- ✅ Performance profissional
- ✅ Migração fácil do Render
- 💰 ~$5/mês

### 4️⃣ ngrok (Temporário)
- ✅ Gratuito para testes
- ✅ Acesso via internet
- ❌ URL muda toda vez
- ❌ Sessões de 2 horas

---

## 📱 Opção 1: Acesso na Rede Local

### Passo 1: Descubra o IP do PC

**Windows:**
```powershell
ipconfig
```

Procure por:
```
Adaptador Wi-Fi:
   IPv4: 192.168.1.10  ← SEU IP
```

### Passo 2: Acesse do Celular/Tablet

No navegador do celular (na **mesma rede WiFi**):
```
http://192.168.1.10:3000
```
*(Substitua pelo seu IP)*

### Passo 3: Liberar Firewall (se necessário)

Se não conseguir acessar, libere a porta:

```powershell
netsh advfirewall firewall add rule name="Halfeld PetCare" dir=in action=allow protocol=TCP localport=3000
```

---

## ☁️ Opção 2: Deploy no Render (Gratuito)

### Vantagens:
- Servidor sempre na nuvem
- Acesse de **qualquer lugar** (4G, 5G, qualquer WiFi)
- URL fixa (ex: `halfeld-petcare.onrender.com`)
- **100% GRATUITO**

### Desvantagens:
- Suspende após 15 minutos sem uso
- Primeiro acesso após suspensão demora ~30 segundos

### Configuração:

1. **Criar conta no Render**
   - Acesse: https://render.com
   - Crie conta (pode usar Google/GitHub)

2. **Criar Web Service**
   - Dashboard → "New +" → "Web Service"
   - Conectar ao repositório Git (ou upload de código)

3. **Configurar**
   - **Name**: `halfeld-petcare`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`

4. **Variáveis de Ambiente**
   
   Adicionar em "Environment":
   ```
   NODE_ENV=production
   SESSION_SECRET=halfeld_secret_key_2025_muito_segura
   PORT=3000
   ```

5. **Deploy**
   - Clique em "Create Web Service"
   - Aguarde ~5 minutos
   - URL será: `https://halfeld-petcare.onrender.com`

6. **Primeiro Acesso**
   - Acesse a URL
   - Faça login com: **admin** / **halfeld2025**

---

## 🚀 Opção 3: Deploy no Railway (Profissional)

**Quando migrar do Render para Railway:**
- Quando o sistema estiver em uso constante
- Quando a espera de 30s incomodar
- Quando precisar de performance profissional

### Configuração:

1. **Criar conta no Railway**
   - Acesse: https://railway.app
   - Login com GitHub

2. **Novo Projeto**
   - Dashboard → "New Project"
   - "Deploy from GitHub repo"
   - Selecione o repositório

3. **Variáveis de Ambiente**
   
   Adicionar em "Variables":
   ```
   NODE_ENV=production
   SESSION_SECRET=halfeld_secret_key_2025_muito_segura
   ```
   *(PORT é automático no Railway)*

4. **Deploy**
   - Railway faz deploy automaticamente
   - URL será: `https://halfeld-petcare-production.up.railway.app`
   - Pode configurar domínio customizado depois

5. **Custo**
   - ~$5/mês com uso normal
   - Railway cobra por uso de recursos

### Migração Render → Railway (5 minutos)

1. Criar projeto no Railway
2. Conectar mesmo repositório
3. Copiar variáveis de ambiente do Render
4. Deploy
5. Testar nova URL
6. Desativar/deletar projeto no Render

**O código é IDÊNTICO - não precisa mudar nada!**

---

## 🔥 Opção 4: ngrok (Testes Rápidos)

Para testes rápidos de acesso via internet:

1. **Baixar ngrok**
   - https://ngrok.com/download
   - Criar conta (grátis)

2. **Configurar**
   ```powershell
   ngrok config add-authtoken SEU_TOKEN
   ```

3. **Iniciar servidor**
   ```powershell
   npm start
   ```

4. **Iniciar túnel (em outro terminal)**
   ```powershell
   ngrok http 3000
   ```

5. **Copiar URL**
   ```
   Forwarding: https://abc123.ngrok.io → localhost:3000
   ```

6. **Acessar de qualquer lugar**
   ```
   https://abc123.ngrok.io
   ```

**Limitações:**
- URL muda toda vez que reinicia
- Sessões de 2 horas no plano grátis

---

## 📊 Comparação Rápida

| Opção | Custo | Sempre Online | Acesso Internet | Complexidade |
|-------|-------|---------------|-----------------|--------------|
| **Rede Local** | Grátis | ✅ | ❌ | 🟢 Fácil |
| **Render** | **Grátis** | ⚠️ Suspende | ✅ | 🟢 Fácil |
| **Railway** | $5/mês | ✅ | ✅ | 🟢 Fácil |
| **ngrok** | Grátis | ✅ | ✅ | 🟡 Médio |

---

## 🎯 Estratégia Recomendada

### Fase 1: DESENVOLVIMENTO (Agora)
Use **Rede Local** para desenvolver e testar

### Fase 2: TESTES (1-2 semanas)
Deploy no **Render** (grátis) para testar acesso remoto

### Fase 3: PRODUÇÃO (Uso diário)
Migre para **Railway** quando estiver usando diariamente

---

## 🔐 Segurança

**O sistema tem:**
- ✅ Login obrigatório
- ✅ Senhas criptografadas
- ✅ Sessões seguras
- ✅ HTTPS automático (Render e Railway)

**Usuários:**
- **Admin**: acesso completo + financeiro
- **Funcionários**: acesso sem financeiro

---

## 📱 Teste de Acesso

Após configurar, teste:

1. ✅ **No PC**: `http://localhost:3000`
2. ✅ **Celular (mesma WiFi)**: `http://[IP-DO-PC]:3000`
3. ✅ **Celular (4G/Internet)**: `https://sua-url.onrender.com`

---

## 🆘 Solução de Problemas

### Render suspendeu o serviço
- Primeiro acesso demora ~30 segundos
- Depois funciona normal até 15 min sem uso
- **Solução permanente**: Migrar para Railway

### Não consigo acessar na rede local
1. Confirme que está na mesma WiFi
2. Verifique IP: `ipconfig`
3. Libere firewall (comando acima)
4. Teste ping: `ping [IP-DO-PC]`

### Esqueci a senha
Execute no servidor:
```powershell
node -e "require('./auth').resetAdminPassword('nova-senha')"
```

---

**Desenvolvido para Halfeld PetCare** 🐾✨
