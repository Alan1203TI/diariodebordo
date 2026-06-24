# Registro Diário de Alunos - GitHub Pages + Firebase

Esta versão foi ajustada para o `index.html` ficar na raiz do repositório, fora da pasta `public`.

## Como publicar no GitHub Pages

No GitHub, vá em:

`Settings > Pages`

Configure assim:

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/root`

Depois clique em `Save`.

## Estrutura correta no repositório

Os arquivos devem aparecer assim logo na primeira tela do repositório:

```txt
index.html
assets/
data/
firebase-config.js
firebase.json
firestore.rules
functions/
README.md
```

## Configurar Firebase

1. Crie um projeto no Firebase.
2. Ative Authentication > E-mail/senha.
3. Crie o Firestore Database.
4. Copie as regras do arquivo `firestore.rules` para a aba Regras do Firestore.
5. Abra `firebase-config.js` e troque a configuração pelo código do seu projeto Firebase.

## Importação inicial

Após publicar e fazer login, entre em `Alunos` e use:

- `Importar alunos da planilha SQL`
- `Importar histórico do Registro Diário`

## Envio de e-mail

O sistema está preparado para duas formas:

1. Cloud Functions: usar a pasta `functions/`.
2. EmailJS: configurar os dados em `firebase-config.js`.

Para GitHub Pages sem servidor, o envio direto por PHP não funciona. O recomendado é Firebase Functions ou EmailJS.


## Criação de usuários pela tela inicial

Esta versão permite criar o primeiro usuário diretamente na tela inicial do sistema, sem precisar criar manualmente no Firebase Authentication.

1. Abra o site publicado no GitHub Pages.
2. Clique em **Criar usuário**.
3. Preencha nome, e-mail e senha.
4. O primeiro usuário criado vira **administrador** automaticamente.
5. Os próximos usuários podem ser criados pela mesma tela como **disciplinário** ou **administrador**.

Depois do cadastro, o sistema cria automaticamente:
- usuário no Firebase Authentication;
- documento correspondente na coleção `usuarios` do Firestore.
