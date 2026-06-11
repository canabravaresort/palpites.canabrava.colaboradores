PALPITE DOS BRAVEIROS - VERSÃO COLABORADORES

O que esta versão tem:
- Login dos participantes com Google.
- Campo obrigatório no palpite: nome do colaborador + número de matrícula.
- Ranking geral dos colaboradores.
- Ranking por partida.
- Admin com e-mail/senha do Firebase Auth.
- 72 jogos da fase de grupos em groupFixtures.js.
- Botão no admin para importar/atualizar todos os jogos da fase de grupos sem duplicar.
- Palpites fecham automaticamente 5 minutos antes do horário do jogo.
- Regras do Firestore também bloqueiam palpite atrasado.
- Mata-mata com opção de pênaltis.
- Admin pode cadastrar jogos de mata-mata com pênaltis.
- Admin lança resultado manualmente.
- Exportação CSV com nome, matrícula, e-mail, jogo, palpite, resultado e data do palpite.
- Pasta functions/ opcional para fechar jogos automaticamente e integrar API-Football.

PASSO A PASSO

1) Firebase Auth
Ative em Authentication > Sign-in method:
- Google
- E-mail/senha

Crie os usuários admin com os e-mails configurados em firebaseConfig.js:
- canabravaresort2@gmail.com
- marketing2@canabravaresort.com.br

2) Firestore Rules
Cole o conteúdo do arquivo regras-firebase.txt em:
Firestore Database > Regras > Publicar

3) Deploy do site
No terminal, dentro da pasta do projeto:
firebase deploy --only hosting

Use firebase deploy completo apenas se você também for subir as Cloud Functions.

4) Importar os jogos
Abra /admin.html, entre como admin e clique em:
Importar fase de grupos

5) Uso pelo colaborador
O colaborador entra com Google, informa nome e matrícula no formulário de palpite, escolhe o jogo e envia o placar.
A matrícula aparece no ranking e no CSV de exportação.

6) Uso do admin
No admin, escolha a partida no dropdown para lançar resultado, salvar status, finalizar ou excluir.
Também é possível exportar CSV e apagar todos os palpites.

7) Mata-mata
Use a área "Cadastrar jogo com pênaltis" para cadastrar partidas de mata-mata.
No site público, quando a partida for mata-mata, aparece a opção:
"Se seu palpite empatar, quem passa nos pênaltis?"

8) Resultado automático via API
A pasta functions/ está pronta como base para:
- Fechar palpites automaticamente no banco a cada 5 minutos.
- Buscar resultados via API-Football quando o jogo tiver externalFixtureId.

Para usar funções:
- Seu projeto Firebase precisa suportar Cloud Functions.
- Configure a chave da API em functions/.env.
- Adicione externalFixtureId nos jogos que deseja automatizar.
- Rode dentro da pasta functions: npm install
- Depois, na raiz do projeto: firebase deploy --only functions

Observação importante:
Não existe uma API oficial gratuita do Google para resultados esportivos. Por isso a base incluída usa Firebase Functions com possibilidade de integração por API-Football/API-Sports.
