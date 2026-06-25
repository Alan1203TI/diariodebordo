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
