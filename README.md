# Registro Diário de Alunos - SESI Dom Bosco

Versão com:

- Área do disciplinário com envio de e-mail aos responsáveis.
- Nova área "Registro professor" para ocorrências internas de sala de aula.
- Registros de professor salvos no histórico do aluno sem envio de e-mail.
- Perfis separados:
  - `disciplinario`: acessa Novo registro e Histórico.
  - `professor`: acessa somente Registro professor.
  - `pedagogia`: acessa Novo registro e Histórico.
  - `admin`: acessa todas as áreas.
- Painel Admin com criação de usuários, importação SQL/alunos e histórico.

## Importante
Os campos da área do professor foram criados com base em ocorrências comuns de sala de aula. Se houver uma imagem/formulário oficial com itens diferentes, substitua as opções no arquivo `assets/app.js`, função/trecho `professorForm` no HTML.

Atualização desta versão:
- Adicionada opção para deletar usuários no painel Admin.
- Usuário deletado do painel perde o acesso ao sistema mesmo que ainda exista no Firebase Authentication.
- A aba completa do aluno agora busca registros antigos por ID, nome, turma e RA/matrícula quando disponível.
- O histórico carregado foi ampliado para até 5000 registros para encontrar registros antigos do aluno.


## Atualização SQL - dados de alunos

A base inicial inclusa em `data/alunos-seed.json` foi atualizada com a planilha `SQL DADOS PARA FORMS ALAN.XLSX` contendo 865 alunos e as colunas: RA ALUNO, ALUNO NOME, CODIGO TURMA, E-MAIL, NOME DO PAI, E-MAIL DO PAI, NOME MÃE, E-MAIL MÃE, NOME RESPONSAVEL ACADEMICO e E-MAIL RESPONSAVEL ACADEMICO.

Na importação de nova planilha SQL, o sistema reconhece automaticamente E-MAIL, E-MAIL DO PAI, E-MAIL MÃE e E-MAIL RESPONSAVEL ACADEMICO. Para envio aos responsáveis são usados mãe, pai e responsável acadêmico quando existirem. O campo E-MAIL do aluno é preservado na ficha completa, mas não é usado como destinatário principal dos responsáveis.

## Atualização dashboard
- Dashboard passa a ser a primeira tela para perfis com acesso.
- Menu reorganizado com Dashboard em primeiro.
- Disciplinário e Pedagogia podem visualizar o Dashboard.
- Datas aceitam padrão brasileiro dd/mm/aaaa e os filtros consideram registros importados do Excel.
- Novo gráfico: professores com mais registros de ocorrência de aluno.
- Gráficos com cores indicativas por tipo/gravidade.

## Login por usuário e senha

Nesta versão o acesso do sistema foi alterado para usuário e senha. O Firebase Authentication continua sendo usado internamente, mas o programa converte o usuário para um e-mail técnico interno no formato `usuario@diariodebordo.com`.

No painel Admin, crie usuários informando:
- nome;
- usuário;
- perfil;
- senha padrão.

No primeiro acesso, o usuário será obrigado a trocar a senha antes de utilizar o sistema.


## Login interno por usuário e senha

Esta versão não usa Firebase Authentication para os usuários do sistema. O login é feito pela coleção `usuarios` no Firestore, usando usuário + senha criptografada por hash.

Usuário administrador inicial criado automaticamente:

- Usuário: `admin`
- Senha: `Sesi@123456`

No primeiro acesso, o sistema exige a troca da senha.

### Regras do Firestore
Publique o arquivo `firestore.rules` incluído neste ZIP. Como o login é interno ao app, as regras precisam permitir acesso ao Firestore sem Firebase Authentication. Use este modelo somente em ambiente controlado.

## Autenticação interna reforçada

Esta versão usa login interno por **usuário + senha** na coleção `usuarios`, com senha armazenada por hash SHA-256 + salt e troca obrigatória no primeiro acesso.

Também foi adicionado Firebase Authentication **anônimo** por trás do sistema para que o Firestore não fique com regras públicas (`if true`). Publique o arquivo `firestore.rules` desta versão no Firebase.

Admin inicial:
- Usuário: `admin`
- Senha: `Sesi@123456`

No primeiro login será solicitada a troca de senha.

Observação: por ser um sistema estático em GitHub Pages, a validação final de perfis ainda acontece no aplicativo. Para uma segurança corporativa completa no banco por perfil, o próximo passo ideal é usar Cloud Functions/custom claims ou um backend.


## Autenticação interna sem Firebase Authentication

Esta versão removeu completamente o uso do Firebase Authentication no app.

Login inicial:
- Usuário: `admin`
- Senha: `Sesi@123456`

No primeiro acesso, o sistema solicita a troca da senha.

Importante:
- Publique o arquivo `firestore.rules` incluso no Firebase.
- Como o login é interno, as regras precisam permitir acesso ao Firestore pelo app.
- Não envie planilhas com dados sensíveis para repositório público.


## Autenticação por e-mail/senha

Esta versão voltou a usar Firebase Authentication por e-mail e senha. Ative o provedor **E-mail/senha** no Firebase Console. Crie o primeiro usuário admin no Authentication e faça o primeiro login; se ainda não existir perfil admin na coleção `usuarios`, o sistema criará o perfil admin automaticamente para esse primeiro usuário autenticado. Depois, use o painel Admin para criar os demais usuários com senha padrão `Sesi@123456` e troca obrigatória no primeiro acesso.

Publique o arquivo `firestore.rules` desta versão no Firebase.
