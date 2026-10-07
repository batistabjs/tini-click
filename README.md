# Tini Click - Gerador de Links Curtos

Uma REST API para geração e gerenciamento de links curtos (URL shortener) construída com Node.js e Express.

## Tecnologias Utilizadas

- **Node.js** - Runtime JavaScript
- **Express.js** (v4.18.2) - Framework web para Node.js
- **MySQL2** (v3.6.0) - Driver MySQL para Node.js
- **Nodemon** (v3.1.14) - Monitor de desenvolvimento para reinício automático
- **Docker** - Containerização da aplicação
- **Docker Compose** - Orquestração de containers

## Pré-requisitos

- Docker e Docker Compose (v2)
- Node.js (v18+) e npm — apenas se for rodar **sem Docker**
- MySQL (v8+) — apenas se for rodar **sem Docker** ou apontar a app para um banco externo

## Como Executar

### Modo Local (recomendado para desenvolvimento)

Sube a aplicação **e** o MySQL local usando `docker-compose-local.yml`.

#### 1. Clonar o repositório

```bash
git clone https://github.com/batistabjs/tini-click.git
cd tini-click
```

#### 2. Configurar o `.env`

Copie o exemplo e ajuste se necessário:

```bash
cp .env-example .env
```

Valores usados no docker compose local:

```env
PORT=9009
NODE_ENV=development
BASE_URL=http://localhost:9009

# Banco do container MySQL local (rede Docker)
DB_HOST=mysql-ivi
DB_PORT=3306
DB_USER=tiniclick
DB_PASSWORD=mudar_senha
DB_NAME=tiniclick
```

#### 3. Garantir a rede Docker usada pelo proxy

```bash
docker network create nginx_proxy
```

#### 4. Subir o app e banco de forma local

```bash
docker compose -f docker-compose-local.yml up -d --build
```

Isso irá:

- Construir e subir o container da aplicação (`app`)
- Subir o MySQL local (`banco`, porta host `3309` → container `3306`)
- Aplicar os scripts em `db-scripts/` na primeira execução
- Conectar app e MySQL na rede externa `nginx_proxy`
- Expor a API em `http://localhost:9009`

#### 5. Verificar

```bash
# Status dos containers
docker compose -f docker-compose-local.yml ps

# Health check da API
curl http://localhost:9009/api/health
```

#### 6. Parar

```bash
docker compose -f docker-compose-local.yml down
```

> Para remover também o volume do MySQL (apaga os dados locais):
>
> ```bash
> docker compose -f docker-compose-local.yml down -v
> ```

---

### Modo Produção

Em produção sobe **somente o container da aplicação** (`docker-compose.yml`).  
O MySQL é **externo** — configure `DB_HOST`, `DB_PORT`, etc. no `.env` do ambiente de produção.

#### 1. Preparar o `.env` de produção

Exemplo (ajuste host, porta, usuário e senha do banco externo):

```env
PORT=9009
NODE_ENV=production
BASE_URL=https://tini.click

# Banco externo (não use mysql-ivi do compose local)
DB_HOST=seu-host-mysql
DB_PORT=3306
DB_USER=tiniclick
DB_PASSWORD=sua_senha_de_producao
DB_NAME=tiniclick
```

#### 2. Garantir a rede do reverse proxy

```bash
docker network create nginx_proxy
```

> A aplicação é exposta nessa rede para o reverse proxy (ex.: Nginx) encaminhar o tráfego.
> O container não depende de MySQL local no compose de produção.

#### 3. Subir apenas a aplicação

```bash
docker compose up -d --build
```

#### 4. Verificar

```bash
docker compose ps
curl http://localhost:9009/api/health
```

#### 5. Parar / atualizar

```bash
# Parar
docker compose down

# Atualizar (rebuild + restart)
docker compose up -d --build
```

> **Importante:** a aplicação só sobe após conseguir conectar ao banco (5 tentativas).  
> Se o healthcheck ficar `unhealthy`, confira `DB_HOST`, rede e credenciais no `.env`.

---

### Alternativa sem Docker (Node.js + MySQL externo/local)

#### 1. Instalar dependências

```bash
npm install
```

#### 2. Configurar `.env` para o banco da sua máquina

```env
PORT=3000
NODE_ENV=development
BASE_URL=http://localhost:3000

DB_HOST=localhost
DB_PORT=3306
DB_USER=seu_usuario_mysql
DB_PASSWORD=sua_senha_mysql
DB_NAME=tiniclick
```

Crie o banco e as tabelas executando os scripts de `db-scripts/` em ordem (`00_schema.sql` …) no MySQL.

#### 3. Executar

```bash
# Desenvolvimento (reload com nodemon)
npm run dev

# Produção (node server.js)
npm start
```

API: `http://localhost:3000` (ou a `PORT` configurada)

---

## Estrutura do Projeto

```
tini-click/
├── server.js                   # API principal (Express + MySQL)
├── dockerfile                  # Build da imagem da aplicação
├── docker-compose.yml          # Produção — somente a aplicação
├── docker-compose-local.yml    # Local — app + MySQL local
├── .env-example                # Exemplo de variáveis de ambiente
├── db-scripts/                 # Scripts de schema/seed do MySQL
│   ├── 00_schema.sql
│   ├── 01_blacklist_domains.sql
│   ├── 02_blacklist_words.sql
│   └── 03_links.sql
├── public/                     # Arquivos estáticos
│   ├── index.html
│   └── docs.html
├── package.json
└── README.md
```

## Configuração do Banco de Dados

A aplicação lê as variáveis de ambiente abaixo:

| Variável       | Descrição                                      |
|----------------|------------------------------------------------|
| `DB_HOST`      | Host do MySQL (ex.: `mysql-ivi` no compose local) |
| `DB_PORT`      | Porta do MySQL (**3306** dentro da rede Docker) |
| `DB_USER`      | Usuário do banco                               |
| `DB_PASSWORD`  | Senha do banco                                 |
| `DB_NAME`      | Nome do banco (`tiniclick`)                    |

Checklist:

1. MySQL acessível a partir da rede da aplicação
2. Credenciais corretas no `.env`
3. Banco e tabelas existentes (local: init automático via `db-scripts/`; produção: aplicar scripts manualmente se o volume for novo)

## Endpoints Principais

| Método | Rota             | Descrição                          |
|--------|------------------|------------------------------------|
| GET    | `/`              | Página inicial                     |
| GET    | `/api/docs`      | Documentação Swagger (HTML)        |
| GET    | `/api?url=...`   | Cria/reutiliza link curto          |
| GET    | `/api/links`     | Lista links                        |
| GET    | `/api/health`    | Health check (app + banco)         |
| GET    | `/:shortCode`    | Redireciona para a URL original    |
| GET    | `/ban/:short_code` | Bane um link                    |

---

**Nota:** Para mais detalhes sobre os endpoints, consulte `public/docs.html`.
