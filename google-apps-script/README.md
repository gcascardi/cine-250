# Google Sheets backend

Este diretório contém o backend do CINE250 para Google Apps Script.

## 1. Criar a planilha e o script

1. Crie uma Planilha Google vazia.
2. Abra **Extensões → Apps Script**.
3. Substitua o conteúdo de `Code.gs` pelo arquivo deste diretório.
4. Em **Configurações do projeto → Propriedades do script**, crie:
   - `SUPABASE_URL`: a URL atual do projeto Supabase.
   - `SUPABASE_ANON_KEY`: a chave anônima atual.
   - `API_TOKEN`: uma string longa e aleatória usada pelo frontend.

## 2. Migrar os dados

No editor do Apps Script, selecione `migrateFromSupabase` e clique em **Executar**.
Autorize o script quando solicitado. A aba `movie_progress` será criada e preenchida.

Confira a quantidade exibida no registro de execução e compare alguns filmes com o Supabase.
Depois da conferência, remova `SUPABASE_URL` e `SUPABASE_ANON_KEY` das propriedades do script.

## 3. Publicar a API

1. Clique em **Implantar → Nova implantação → Aplicativo da Web**.
2. Execute como **você**.
3. Permita acesso a **qualquer pessoa**.
4. Copie a URL terminada em `/exec`.

## 4. Configurar o Vite

Crie as variáveis:

```env
VITE_GOOGLE_SHEETS_API_URL=https://script.google.com/macros/s/SEU_DEPLOYMENT_ID/exec
VITE_GOOGLE_SHEETS_API_TOKEN=o_mesmo_valor_de_API_TOKEN
```

Em hospedagens como Vercel, cadastre as duas variáveis no projeto e faça um novo deploy.

> O token do frontend reduz alterações acidentais, mas não é um segredo real porque fica visível no navegador. Para autenticação forte seria necessário adicionar login e um backend privado.

## 5. Validar e encerrar o Supabase

1. Abra o CINE250 e confirme que os 250 filmes carregam.
2. Altere e salve um filme; recarregue a página e confirme a persistência.
3. Faça uma alteração em lote e repita o teste.
4. Valide os totais de Guilherme, Gisele e progresso conjunto.
5. Só depois remova as variáveis antigas do Supabase e desative o projeto.
