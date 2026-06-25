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
