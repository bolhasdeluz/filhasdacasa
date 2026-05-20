# Filhas da Casa — Consulta Pública

Página pública de consulta de filhas e guias, com notas livres por guia.
Dados de perfil vêm do Odoo; notas são armazenadas no Netlify Blobs.

---

## Estrutura

```
public/
  index.html              ← página principal (HTML estático)
netlify/
  functions/
    partners.mjs          ← proxy para a API do Odoo
    notes.mjs             ← CRUD de notas (Netlify Blobs)
netlify.toml              ← config de deploy
package.json              ← dependência: @netlify/blobs
```

---

## Deploy no Netlify

### 1. Fork / upload este repositório no GitHub (ou GitLab)

### 2. Conectar ao Netlify
- Acesse https://app.netlify.com → **Add new site** → **Import from Git**
- Selecione o repositório
- Netlify detecta o `netlify.toml` automaticamente

### 3. Configurar variáveis de ambiente

No painel do Netlify: **Site configuration → Environment variables**

| Variável     | Exemplo                          | Descrição                         |
|--------------|----------------------------------|-----------------------------------|
| `ODOO_URL`   | `https://suaempresa.odoo.com`    | URL base do Odoo (sem barra final)|
| `ODOO_DB`    | `minha_empresa`                  | Nome do banco de dados Odoo       |
| `ODOO_USER`  | `bolhasdeluz@gmail.com`          | Login do usuário de serviço       |
| `ODOO_PASS`  | `sua_senha_aqui`                 | Senha do usuário Odoo             |

> **Dica de segurança:** Crie um usuário Odoo de leitura exclusiva para este serviço,
> em vez de usar a conta admin principal.

### 4. Habilitar Netlify Blobs
Netlify Blobs é habilitado automaticamente quando você usa `getStore()`.
Não é necessária nenhuma configuração extra — funciona out-of-the-box.

### 5. Deploy
Clique em **Deploy site**. Após alguns segundos, a página estará no ar.

---

## Como usar

- Acesse a URL do site no Netlify
- Os cards das filhas carregam automaticamente
- Clique num card → painel lateral com os guias
- Clique num guia → modal para escrever / editar notas
- Notas com conteúdo aparecem com um **ponto dourado** no painel
- Use a barra de busca para filtrar por nome ou cargo

---

## Personalização

Para adicionar novos tipos de guia, edite o array `GUIDES` no `public/index.html`:

```js
const GUIDES = [
  { key: 'x_studio_caboclo',     type: 'Caboclo',     icon: '🏹' },
  { key: 'x_studio_exu',         type: 'Exu',         icon: '🔱' },
  // adicione mais campos aqui...
];
```

O `key` deve corresponder ao nome do campo técnico no Odoo.
Lembre de incluir o campo também no array `fields` dentro de `netlify/functions/partners.mjs`.
