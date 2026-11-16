# Clínica – Mapa Interativo

Painel administrativo visual para gerenciamento de quartos de clínica.

## Como usar

### 1. Configurar Supabase

1. Acesse [https://supabase.com](https://supabase.com) e crie um projeto gratuito
2. No painel do projeto, vá em **SQL Editor** e execute o conteúdo de `supabase-setup.sql`
3. Vá em **Project Settings → API** e copie:
   - **Project URL** (ex: `https://abc123.supabase.co`)
   - **anon public key**
4. Abra `supabase-config.js` e substitua:
   ```js
   const SUPABASE_URL = 'https://SEU_PROJETO.supabase.co';
   const SUPABASE_ANON_KEY = 'SUA_ANON_KEY_AQUI';
   ```

### 2. Abrir o sistema

Abra o arquivo `index.html` diretamente no navegador (Chrome ou Edge recomendados).

> **Nota:** Se o Supabase não estiver configurado, o sistema funciona normalmente usando localStorage — os dados são salvos no navegador automaticamente.

---

## Funcionalidades

| Recurso | Como usar |
|---|---|
| **Arrastar quartos** | Clique e arraste qualquer elemento |
| **Redimensionar** | Ative Modo Edição → arraste o ponto azul no canto |
| **Rotacionar** | Ative Modo Edição → arraste o botão ↻ acima do elemento |
| **Editar quarto** | Clique no quarto → preencha o painel lateral → Salvar |
| **Adicionar quarto** | Botão "+ Adicionar Quarto" ou ferramentas da barra |
| **Duplicar/Excluir** | Clique direito no elemento |
| **Zoom** | Scroll do mouse ou botões +/− |
| **Mover mapa** | Clique e arraste a área em branco |
| **Grade** | Ative Modo Edição → marque "Grade" |
| **Snap** | Alinhamento automático a grade de 10px (desative em Modo Edição) |
| **Salvar no banco** | Botão "Salvar" na barra de ferramentas (Modo Edição) |

## Cores dos quartos

- 🔵 **Azul claro** – Quarto livre (Individual)
- 🟢 **Verde claro** – Quarto ocupado
- 💙 **Azul médio** – Suíte

## Estrutura de arquivos

```
clinic-map/
├── index.html          # Interface principal
├── style.css           # Estilos
├── app.js              # Lógica principal
├── supabase-config.js  # Configuração do Supabase
├── supabase-setup.sql  # Script para criar a tabela no Supabase
└── README.md           # Este arquivo
```
