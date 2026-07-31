# Cine250

## Objetivo

Cine250 é uma aplicação web para ajudar Guilherme e Gisele a escolher qual filme assistir.

A aplicação utiliza uma lista baseada no IMDb Top 250 e realiza um sorteio ponderado conforme o histórico de filmes assistidos.

---

# Stack

- React
- Vite
- JavaScript
- CSS puro
- Supabase
- Vercel

---

# Princípios

- Interface simples
- Código limpo
- Componentes pequenos
- Fácil manutenção
- Sem complexidade desnecessária

Não utilizar:

- TypeScript
- Tailwind
- Bootstrap
- Material UI
- Redux
- Context API
- Bibliotecas de animação

---

# Estrutura

```
public/
    movies.json

src/
    components/
    services/
    utils/

    App.jsx
    App.css
    main.jsx
```

---

# Filmes

Todos os filmes ficam em:

```
public/movies.json
```

Cada registro possui:

```json
{
  "id": 1,
  "imdbId": "tt0111161",
  "title": "The Shawshank Redemption",
  "year": 1994,
  "rating": 9.3,
  "poster": "",
  "synopsis": ""
}
```

Esse arquivo é considerado a base oficial da aplicação.

Não salvar progresso nele.

---

# Banco

Utilizar Supabase.

Tabela:

```
movie_progress
```

Campos:

```
movie_id

watched_guilherme
watched_gisele

rewatch_guilherme
rewatch_gisele

updated_at
```

Cada filme possui apenas um registro.

---

# Pessoas

Existem apenas dois usuários.

- Guilherme
- Gisele

Não implementar login.

---

# Regras

Cada pessoa possui dois estados.

```
Assistiu

Reassistiria
```

A opção "Reassistiria" somente pode ser marcada caso a pessoa tenha assistido.

Ao desmarcar "Assistiu", a estrela deve ser removida automaticamente.

---

# Sorteio

Peso 10

Nenhum assistiu.

Peso 4

Apenas um assistiu.

Peso 1

Ambos assistiram.

Cada estrela adiciona:

```
+3
```

Exemplo:

```
Ninguém assistiu

Peso 10
```

```
Apenas Guilherme assistiu

Peso 4
```

```
Ambos assistiram

Peso 1
```

```
Ambos assistiram

Guilherme marcou reassistiria

Peso 4
```

```
Ambos marcaram reassistiria

Peso 7
```

Nenhum filme deve ser excluído do sorteio.

---

# Interface

A aplicação possui apenas uma página.

Elementos:

- Cabeçalho
- Botão "Sortear filme"
- Card do filme sorteado
- Lista completa dos filmes

---

# Card do filme

Mostrar:

- Pôster
- Título
- Ano
- Nota IMDb
- Sinopse
- Botão para abrir o IMDb

Também mostrar:

```
Guilherme

[ ] Assistiu

[ ] Reassistiria
```

```
Gisele

[ ] Assistiu

[ ] Reassistiria
```

Botão:

```
Salvar
```

---

# Lista de filmes

Tabela contendo:

- Título
- Ano
- Nota
- Guilherme
- Gisele

Permitir:

- Pesquisa por título
- Ordenação por nota

---

# Fluxo

Ao abrir a aplicação:

1. Carregar movies.json
2. Carregar movie_progress
3. Fazer merge pelo movie_id
4. Exibir os filmes

Ao salvar:

Atualizar apenas a tabela movie_progress.

---

# Supabase

Criar:

```
src/services/supabase.js
```

Variáveis de ambiente:

```
VITE_SUPABASE_URL

VITE_SUPABASE_ANON_KEY
```

Nunca colocar credenciais diretamente no código.

---

# Estrutura sugerida

```
src/

components/

    Header.jsx

    MovieCard.jsx

    MovieTable.jsx

    PersonStatus.jsx

services/

    supabase.js

utils/

    weightedRandom.js

    normalizeText.js

App.jsx

App.css

main.jsx
```

---

# Estilo

Visual moderno e discreto.

Priorizar:

- boa leitura
- espaçamento consistente
- responsividade
- simplicidade

Evitar:

- gradientes exagerados
- animações
- efeitos visuais desnecessários
- excesso de cores

---

# MVP

O MVP estará pronto quando for possível:

- visualizar os 250 filmes
- pesquisar filmes
- sortear um filme
- visualizar pôster
- visualizar sinopse
- visualizar nota IMDb
- marcar assistido
- marcar reassistiria
- salvar no Supabase
- abrir em outro dispositivo e continuar de onde parou

---

# Deploy

Frontend

```
Vercel
```

Banco

```
Supabase
```

Código

```
GitHub
```