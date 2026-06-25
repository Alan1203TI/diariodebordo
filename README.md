# Registro Diário
## Firebase já configurado

Este ZIP já está com o projeto Firebase `diariodebordo-618c6` configurado em `firebase-config.js`.

No Firebase, ainda confira:

1. Authentication > Sign-in method > ativar **E-mail/senha**.
2. Firestore Database > criar banco.
3. Firestore Database > Regras > colar o conteúdo de `firestore.rules`.
4. Subir os arquivos na raiz do GitHub e usar GitHub Pages em `main /root`.

 de Alunos - GitHub Pages + Firebase

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


## Correção de importação
Nesta versão o app.js importa apenas firebaseConfig. O EmailJS é opcional via window.emailJsConfig, evitando erro de export não encontrado.


## EmailJS - template bonito sem duplicidade

Nesta versão o envio do EmailJS foi ajustado para não duplicar o conteúdo.  
A variável `detalhes_registro` agora não inclui mais o `textoEmail` inteiro, e foi adicionada a variável `detalhes_html` para usar em um layout mais bonito.

### Configuração do template no EmailJS

No EmailJS, abra o template atual e mantenha:

- **Para enviar um e-mail:** `{{to_email}}`
- **Responder a:** `{{reply_to}}`
- **De Nome:** `{{name}}`
- **Assunto:** `Registro Diário - {{aluno_nome}} - {{controle_diario}}`

Depois clique em **Editar conteúdo** e cole o conteúdo do arquivo:

`emailjs-template-registro-diario.html`

### Logo

Foi adicionada a imagem:

`assets/logo-sesi-dom-bosco.png`

O sistema envia a variável `{{logo_url}}` automaticamente com o caminho público da logo no GitHub Pages.


## Alterações desta versão
- Identidade visual atualizada com logo SESI e imagem da unidade em `assets/`.
- Histórico mostra o nome do usuário e o cargo, por exemplo: `Alan Rodrigues (admin)`.
- E-mail aos responsáveis não exibe o e-mail pessoal do usuário; usa `Registrado pela equipe disciplinar do SESI Dom Bosco.`
- Adicionada opção de apagar registro nos detalhes do histórico para usuários admin.
- Envio para pedagogia: configure o e-mail em Admin > E-mail da pedagogia/cópia e, no EmailJS, coloque o campo Cc como `{{cc_email}}`.
- O template HTML atualizado está em `emailjs-template-registro-diario.html`.


## Atualização desta versão

- A criação de usuários saiu da tela de login e agora fica em **Admin > Criar usuários do sistema**.
- Administradores podem criar usuários informando nome, e-mail, senha e perfil.
- O painel Admin agora possui uma área para importar uma nova planilha SQL de alunos em formato `.xlsx`, `.xls` ou `.csv`. Todas as colunas da planilha são preservadas na aba do aluno.
- O painel Admin também possui uma área para importar histórico do Registro Diário em formato `.xlsx`, `.xls` ou `.csv`.
- Para permitir que administradores criem documentos de usuários no Firestore, publique novamente o arquivo `firestore.rules` incluído nesta versão.

### Importação de alunos

A planilha de alunos pode conter várias colunas. O sistema tenta reconhecer automaticamente nome, turma, RA e e-mail da mãe. O campo usado prioritariamente para envio é o e-mail da mãe, reconhecendo variações como `E-MAIL MÃE`, `EMAIL MAE`, `EMAIL_MAE` e semelhantes.

### Criação de usuários

Antes de criar usuários pelo painel, confirme que o usuário logado possui `role: admin` na coleção `usuarios`.
