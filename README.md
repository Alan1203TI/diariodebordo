# Registro Diário de Alunos — GitHub Pages + Firebase

Sistema convertido para funcionar sem PHP.

## O que está incluso

- Site estático pronto para GitHub Pages na pasta `public/`.
- Firebase Authentication para login.
- Firestore como banco de dados.
- Importação inicial dos alunos da planilha SQL.
- Importação do histórico do Registro Diário.
- Formulário com todos os campos encontrados na planilha de Registro Diário.
- Cadastro/edição simples de alunos e e-mails dos responsáveis.
- Histórico de ocorrências com filtro e exportação CSV.
- Envio de e-mail por duas opções:
  - **Cloud Functions + SMTP**: recomendado/profissional.
  - **EmailJS**: alternativa sem backend, com limite gratuito, configurável em `public/firebase-config.js`.

## Publicar no GitHub Pages

1. Crie um repositório no GitHub.
2. Envie os arquivos deste ZIP.
3. No GitHub, vá em **Settings > Pages**.
4. Em **Build and deployment**, escolha:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/public`
5. Salve.

## Configurar Firebase

1. Acesse o Firebase Console e crie um projeto.
2. Ative **Authentication > Sign-in method > Email/Password**.
3. Crie pelo menos um usuário admin em **Authentication > Users**.
4. Ative **Firestore Database**.
5. Crie um app Web no Firebase.
6. Copie a configuração do app Web para `public/firebase-config.js`.

## Primeiro acesso

Depois de entrar com o usuário criado no Firebase Authentication, o sistema cria esse usuário como `admin` automaticamente se ele ainda não existir na coleção `usuarios`.

Depois use a tela **Alunos** para importar:

1. `Importar alunos da planilha SQL`.
2. `Importar histórico do Registro Diário`.

Atenção: na planilha SQL enviada, a base importada ficou com alunos e turmas, mas os e-mails dos responsáveis vieram vazios. Por isso o sistema já tem tela para cadastrar/editar os e-mails antes de usar o disparo real.

## Regras do Firestore

Use o arquivo `firestore.rules` deste ZIP.

Para teste inicial, pode publicar as regras pelo console do Firebase. Para produção, revise os perfis de acesso conforme a política da escola.

## Envio de e-mail recomendado: Cloud Functions + SMTP

A pasta `functions/` contém a função `enviarEmailOcorrencia`. Ela dispara automaticamente quando um novo documento é criado em `ocorrencias`.

### Instalação

No terminal, dentro da pasta do projeto:

```bash
npm install -g firebase-tools
firebase login
firebase init functions
```

Quando o Firebase perguntar, você pode manter a pasta `functions` já existente.

Depois configure os segredos SMTP:

```bash
firebase functions:secrets:set SMTP_USER
firebase functions:secrets:set SMTP_PASS
firebase functions:secrets:set SMTP_HOST
firebase functions:secrets:set SMTP_PORT
```

Exemplo SMTP:

- SMTP_HOST: `smtp.gmail.com`
- SMTP_PORT: `587`
- SMTP_USER: e-mail remetente
- SMTP_PASS: senha de app do Gmail ou senha SMTP do provedor

Deploy:

```bash
firebase deploy --only functions
```

Observação: Cloud Functions normalmente exige plano Blaze no Firebase. Se você não puder usar Blaze, use EmailJS como alternativa.

## Alternativa sem Cloud Functions: EmailJS

Em `public/firebase-config.js`, preencha:

```js
export const emailJsConfig = {
  enabled: true,
  publicKey: "SUA_PUBLIC_KEY",
  serviceId: "SEU_SERVICE_ID",
  templateId: "SEU_TEMPLATE_ID"
};
```

Crie um template no EmailJS com variáveis:

- `to_email`
- `cc_email`
- `aluno`
- `turma`
- `data`
- `ocorrencia`
- `providencia`
- `disciplinario`

## Coleções usadas no Firestore

- `alunos`
- `ocorrencias`
- `usuarios`
- `configuracoes`

## Observação importante

GitHub Pages não executa PHP, Node ou SQL. Por isso o banco foi migrado para Firebase/Firestore e a parte de e-mail foi separada em Cloud Function ou EmailJS.
