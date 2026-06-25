import { firebaseConfig } from '../firebase-config.js';
const emailJsConfig = window.emailJsConfig || { enabled:false, publicKey:'', serviceId:'', templateId:'' };
import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, updatePassword } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, setDoc, addDoc, getDocs, deleteDoc, query, where, orderBy, limit, serverTimestamp, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const state = { user:null, profile:{role:'disciplinario'}, alunos:[], historico:[], config:{}, registroAberto:null, alunoAberto:null, allUsuarios:[] };
const colecoes = { alunos:'alunos', ocorrencias:'ocorrencias', usuarios:'usuarios', config:'configuracoes' };

function norm(v=''){
  return String(v||'')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .trim();
}
function normKey(v=''){
  return norm(v)
    .replace(/ãƒe/g,'mae')
    .replace(/mãe/g,'mae')
    .replace(/[^a-z0-9]/g,'');
}
function cleanEmail(v=''){
  return String(v||'')
    .trim()
    .replace(/^mailto:/i,'')
    .replace(/[;,]+$/,'')
    .replace(/\s+/g,'');
}
function extrairEmails(v=''){
  const texto = String(v||'');
  const matches = texto.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return matches.map(cleanEmail).filter(emailValido).filter((e,i,arr)=>arr.indexOf(e)===i);
}
function emailValido(v=''){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail(v));
}
function getEmailByHeader(obj, nomes=[]){
  const entries = Object.entries(obj||{});
  const targets = nomes.map(normKey);
  for(const [k,v] of entries){
    const nk = normKey(k);
    if(targets.includes(nk)){
      const emails = extrairEmails(v);
      if(emails.length) return emails[0];
    }
  }
  for(const [k,v] of entries){
    const nk = normKey(k);
    if(targets.some(t=>nk.includes(t) || t.includes(nk))){
      const emails = extrairEmails(v);
      if(emails.length) return emails[0];
    }
  }
  return '';
}
function getEmailsByHeader(obj, nomes=[]){
  const entries = Object.entries(obj||{});
  const targets = nomes.map(normKey);
  const out=[];
  for(const [k,v] of entries){
    const nk = normKey(k);
    const match = targets.includes(nk) || targets.some(t=>nk.includes(t) || t.includes(nk));
    if(match){
      extrairEmails(v).forEach(e=>{ if(!out.includes(e)) out.push(e); });
    }
  }
  return out;
}
function detectEmailsAluno(obj={}){
  const emailMae = getEmailByHeader(obj,['E-MAIL MÃE','EMAIL MÃE','E-MAIL MAE','EMAIL MAE','EMAIL_MAE','EMAIL DA MÃE','EMAIL DA MAE','EMAILMÃE','EMAILMAE']);
  const emailPai = getEmailByHeader(obj,['E-MAIL DO PAI','EMAIL DO PAI','E-MAIL PAI','EMAIL PAI','EMAIL_PAI','EMAIL DO RESPONSAVEL PAI','EMAILPAI']);
  const emailResponsavelAcademico = getEmailByHeader(obj,['E-MAIL RESPONSAVEL ACADEMICO','EMAIL RESPONSAVEL ACADEMICO','E-MAIL RESPONSÁVEL ACADÊMICO','EMAIL RESPONSÁVEL ACADÊMICO','EMAIL RESPONSAVEL','E-MAIL RESPONSAVEL','EMAILRESPONSAVELACADEMICO']);
  const emailAluno = getEmailByHeader(obj,['E-MAIL','EMAIL','EMAIL ALUNO','E-MAIL ALUNO','EMAIL DO ALUNO','E-MAIL DO ALUNO']);
  const emailsResponsaveis = [
    ...getEmailsByHeader(obj,['E-MAIL MÃE','EMAIL MÃE','E-MAIL MAE','EMAIL MAE','EMAIL DA MÃE','EMAIL DA MAE','EMAILMAE']),
    ...getEmailsByHeader(obj,['E-MAIL DO PAI','EMAIL DO PAI','E-MAIL PAI','EMAIL PAI','EMAILPAI']),
    ...getEmailsByHeader(obj,['E-MAIL RESPONSAVEL ACADEMICO','EMAIL RESPONSAVEL ACADEMICO','E-MAIL RESPONSÁVEL ACADÊMICO','EMAIL RESPONSÁVEL ACADÊMICO','EMAIL RESPONSAVEL','E-MAIL RESPONSAVEL','EMAILRESPONSAVELACADEMICO'])
  ].filter(Boolean).filter((e,i,arr)=>arr.indexOf(e)===i);
  return { emailAluno, emailMae, emailPai, emailResponsavelAcademico, emailsResponsaveis };
}
function detectMaeEmail(obj){
  return detectEmailsAluno(obj).emailMae || '';
}
function getField(obj, nomes=[]){
  const entries = Object.entries(obj||{});
  for(const nome of nomes){
    const hit = entries.find(([k,v])=> norm(k)===norm(nome) && v!==undefined && v!==null && String(v).trim()!=='');
    if(hit) return String(hit[1]).trim();
  }
  for(const nome of nomes){
    const n = norm(nome);
    const hit = entries.find(([k,v])=> norm(k).includes(n) && v!==undefined && v!==null && String(v).trim()!=='');
    if(hit) return String(hit[1]).trim();
  }
  return '';
}
function normalizarLinhaPlanilha(row={}){
  const out={};
  Object.entries(row||{}).forEach(([k,v])=>{
    if(k===undefined || k===null || String(k).trim()==='') return;
    if(v instanceof Date) out[String(k).trim()] = v.toLocaleDateString('pt-BR');
    else out[String(k).trim()] = v ?? '';
  });
  return out;
}
function mapAlunoImportado(row={}){
  const a = normalizarLinhaPlanilha(row);
  const nome = getField(a,['ALUNO NOME','NOME ALUNO','NOME DO ALUNO','ALUNO','NOME','Nome do aluno']) || a.nome || '';
  const turma = getField(a,['CODIGO TURMA','CÓDIGO TURMA','TURMA','COD TURMA','Código Turma']) || a.turma || '';
  const ra = getField(a,['RA ALUNO','RA','MATRICULA','MATRÍCULA','ID ALUNO']);
  const nomePai = getField(a,['NOME DO PAI','PAI','NOME PAI']);
  const nomeMae = getField(a,['NOME MÃE','NOME MAE','MÃE','MAE','NOME DA MÃE','NOME DA MAE']);
  const nomeResponsavelAcademico = getField(a,['NOME RESPONSAVEL ACADEMICO','NOME RESPONSÁVEL ACADÊMICO','RESPONSAVEL ACADEMICO','RESPONSÁVEL ACADÊMICO']);
  const emails = detectEmailsAluno(a);
  const id = slug(`${turma}-${ra || nome}`);
  return {
    ...a,
    id,
    nome,
    turma,
    raAluno: ra,
    nomePai,
    nomeMae,
    nomeResponsavelAcademico,
    emailAluno: emails.emailAluno,
    emailMae: emails.emailMae,
    emailPai: emails.emailPai,
    emailResponsavelAcademico: emails.emailResponsavelAcademico,
    emailsResponsaveis: emails.emailsResponsaveis,
    emailResponsavel1: emails.emailMae || emails.emailResponsavelAcademico || emails.emailPai || '',
    emailResponsavel2: emails.emailPai || '',
    emailResponsavel3: emails.emailResponsavelAcademico || '',
    dadosCompletos: a,
    ativo:true
  };
}
function mapHistoricoImportado(row={}){
  const r = normalizarLinhaPlanilha(row);
  const aluno = getField(r,['ALUNO','ALUNO NOME','NOME ALUNO','NOME DO ALUNO','Nome do aluno']) || r.ALUNO || '';
  const turma = getField(r,['TURMA','CODIGO TURMA','CÓDIGO TURMA','COD TURMA']) || r.TURMA || '';
  const data = getField(r,['DATA','DATA DO REGISTRO','DATA REGISTRO','Data']) || today();
  const controle = getField(r,['CONTROLE DIÁRIO','CONTROLE DIARIO','TIPO','TIPO DE REGISTRO','REGISTRO']) || r['CONTROLE DIÁRIO'] || 'Histórico importado';
  const baseId = getField(r,['ID','Nº','NUMERO','NÚMERO']) || `${aluno}-${turma}-${data}-${controle}`;
  return { ...r, id:`hist-${slug(baseId)}`, ALUNO:aluno, TURMA:turma, DATA:toISODate(data) || data, dataOriginalImportada:data, ['CONTROLE DIÁRIO']:controle, createdAtLocal:new Date().toISOString(), statusEmail:'historico-importado' };
}
async function lerPlanilhaArquivo(input){
  const file = input?.files?.[0];
  if(!file) throw new Error('Selecione um arquivo .xlsx, .xls ou .csv.');
  if(!window.XLSX) throw new Error('Biblioteca de planilha não carregada. Atualize a página e tente novamente.');
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer,{type:'array',cellDates:true});
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws,{defval:'',raw:false});
}

const TURMAS_FORMS = ['1º ALFA','1º ÔMEGA','2º ALFA','2º ÔMEGA','3º ALFA','3º ÔMEGA'];
const FORM_SECTIONS = {
  'ATRASOS': {
    titulo:'ALUNOS ATRASADOS',
    fields:[
      {n:5,name:'HORÁRIO', label:'Horário', type:'select', options:['7:05','7:06','7:07','7:08','7:09','7:11','7:12','7:13','7:14','7:15','7:20','7:30','7:50','8:40','9:30','Outra']},
      {n:6,name:'MOTIVO', label:'Motivo', type:'select', options:['TRÂNSITO','MÉDICO','SEM MOTIVO JUSTIFICÁVEL','PERDEU A HORA','PASSANDO MAL','CONDIÇÕES CLIMÁTICAS','Outra']}
    ]
  },
  'TAREFA, LIVRO E ATIVIDADES': {
    titulo:'TAREFAS, LIVRO E ATIVIDADES',
    fields:[
      {n:7,name:'HORÁRIO MANHÃ', label:'Horário manhã', type:'select', options:['1º horário','2º horário','3º horário','4º horário','5º horário','6º horário','Outra']},
      {n:8,name:'DISCIPLINA', label:'Disciplina', type:'select', options:['MATEMÁTICA','PORTUGUÊS','HISTÓRIA','GEOGRAFIA','CIÊNCIAS','PRODUÇÃO DE TEXTO','LITERATURA','ARTE','INGLÊS','EDUCAÇÃO FÍSICA','Outra']},
      {n:9,name:'TAREFA', label:'Tarefa', type:'radio', options:['Tarefa incompleta','Não realizou a atividade','Entregou fora do prazo']},
      {n:10,name:'LIVRO DIDÁTICO', label:'Livro didático', type:'radio', options:['Não trouxe o livro para a aula']}
    ]
  },
  'SAÚDE': {
    titulo:'SAÚDE',
    fields:[
      {n:11,name:'SINTOMAS', label:'Sintomas', type:'select', options:['DIARRÉIA','DIFICULDADE RESPIRATÓRIA','DOR DE BARRIGA','DOR DE CABEÇA','DOR DE DENTE','DOR DE ESTÔMAGO','DOR DE GARGANTA','DOR DE OUVIDO','DOR NAS COSTAS','DOR NO JOELHO','DOR NO PÉ','DOR NO PEITO','DOR NO PESCOÇO','DOR NOS OLHOS','DOR NOS OMBROS','FEBRE < 37,5º','FEBRE > 37,5º','FEBRE > 38º','FEBRE > 39º','NARIZ SANGRANDO','TONTURA','VÔMITO','MACHUCOU O PÉ','MACHUCOU TORNOZELO','MACHUCOU DEDO','ENJOO','ALERGIA','Outra']},
      {n:12,name:'CONTATO COM RESPONSÁVEIS', label:'Contato com responsáveis', type:'select', options:['RESPONSÁVEIS CIENTES, VIERAM BUSCAR O ALUNO.','RESPONSÁVEIS CIENTES, NÃO VIERAM BUSCAR O ALUNO.','RESPONSÁVEIS NÃO ATENDEM, DEIXAMOS MENSAGEM.','Outra']}
    ]
  },
  'SAÍDA ANTECIPADA': {
    titulo:'SAÍDA ANTECIPADA',
    fields:[
      {n:13,name:'MOTIVO SAÍDA', label:'Motivo', type:'select', options:['CONSULTA MÉDICA','ÔNIBUS','MOTIVOS PESSOAIS','DENTISTA','Outra']}
    ]
  },
  'UNIFORME INADEQUADO': {
    titulo:'UNIFORME INADEQUADO',
    fields:[
      {n:14,name:'UNIFORME', label:'Uniforme', type:'select', options:['BLUSA INADEQUADA','CALÇA INADEQUADA','BERMUDA INADEQUADA','AGASALHO INADEQUADO','CHINELO SEM JUSTIFICATIVA','Outra']},
      {n:15,name:'COMUNICADO À FAMÍLIA', label:'Comunicado à família', type:'select', options:['RESPONSÁVEL ESTÁ CIENTE E RESPONDEU QUE IRÁ PROVIDENCIAR A COMPRA.','RESPONSÁVEL ESTÁ CIENTE E RESPONDEU QUE O UNIFORME ESTÁ MOLHADO/LAVANDO.','NÃO FOI POSSÍVEL COMUNICAR COM O RESPONSÁVEL.','Outra']}
    ]
  },
  'OCORRÊNCIAS': {
    titulo:'OCORRÊNCIAS',
    fields:[
      {n:16,name:'LOCAL DA OCORRÊNCIA', label:'Local da ocorrência', type:'select', options:['SALA DE AULA','QUADRA DA ESCOLA','BANHEIROS','PÁTIO','SALA MAKER','BIBLIOTECA','BRINQUEDOTECA','ESCADAS','CORREDORES 1º ANDAR','CORREDORES 2º ANDAR','CORREDORES 3º ANDAR','LABORATÓRIO DE CIÊNCIAS','LABORATÓRIO DE ROBÓTICA','MEZANINO 2º ANDAR','MULTIMEIOS','Outra']},
      {n:17,name:'PROVIDÊNCIA', label:'Providência', type:'select', options:['CONVERSA COM OS DISCIPLINÁRIOS','COMUNICADO PARA OS RESPONSÁVEIS','ADVERTÊNCIA','SUSPENSÃO','Outra']},
      {n:18,name:'DESCREVA O OCORRIDO', label:'Descreva o ocorrido', type:'textarea', required:true}
    ]
  },
  'SUSPENSÃO': {
    titulo:'SANÇÕES',
    fields:[
      {n:19,name:'SANÇÕES', label:'Sanções', type:'select', options:['ADVERTÊNCIA','SUSPENSÃO','Outra']},
      {n:20,name:'NATUREZA', label:'Natureza', type:'select', options:['LEVE','MÉDIA','GRAVE']},
      {n:21,name:'DESCREVA O OCORRIDO', label:'Descreva o ocorrido', type:'textarea', required:true},
      {n:22,name:'DATA E HORA', label:'Data e hora', type:'datetime-local'}
    ]
  },
  'ADVERTÊNCIA': {
    titulo:'SANÇÕES',
    fields:[
      {n:19,name:'SANÇÕES', label:'Sanções', type:'select', options:['ADVERTÊNCIA','SUSPENSÃO','Outra']},
      {n:20,name:'NATUREZA', label:'Natureza', type:'select', options:['LEVE','MÉDIA','GRAVE']},
      {n:21,name:'DESCREVA O OCORRIDO', label:'Descreva o ocorrido', type:'textarea', required:true},
      {n:22,name:'DATA E HORA', label:'Data e hora', type:'datetime-local'}
    ]
  },
  'RECONHECIMENTO': {
    titulo:'RECONHECIMENTO',
    fields:[
      {n:23,name:'COMPORTAMENTO E ATITUDES', label:'Comportamento e atitudes', type:'radio', options:['Respeitoso com colegas e professores','Colaborativo','Age com responsabilidade','Age com empatia']},
      {n:24,name:'DESEMPENHO ACADÊMICO', label:'Desempenho acadêmico', type:'radio', options:['Excelente desempenho acadêmico','Superou dificuldades com dedicação','Participa ativamente das aulas','Destaque em (descreva no campo de escrita)']},
      {n:25,name:'PROATIVIDADE E PARTICIPAÇÃO', label:'Proatividade e participação', type:'radio', options:['Envolvimento em projetos escolares','Exercita liderança positiva']},
      {n:26,name:'HABILIDADES E TALENTOS', label:'Habilidades e talentos', type:'radio', options:['Talento artístico, esportivo ou cultural']},
      {n:27,name:'COMPORTAMENTO E ORGANIZAÇÃO', label:'Comportamento e organização', type:'radio', options:['Entrega de atividades com qualidade','Organizado e responsável','Assíduo e pontual','Busca constante por melhorias']},
      {n:28,name:'TRABALHO EM EQUIPE', label:'Trabalho em equipe', type:'radio', options:['Coopera e respeita opiniões em grupo','Incentiva e motiva os colegas','Ajuda espontaneamente quem precisa']},
      {n:29,name:'RECONHECIMENTOS ESPECIAIS', label:'Reconhecimentos especiais', type:'radio', options:['Aluno destaque do mês','Maior evolução do trimestre','Destaque em leitura - biblioteca','Medalhista em competição escolar']},
      {n:30,name:'DESCREVA O RECONHECIMENTO', label:'Descreva o reconhecimento', type:'textarea'},
      {n:31,name:'DATA E HORA', label:'Data e hora', type:'datetime-local'}
    ]
  }
};
const CONTROLE_OPTIONS = Object.keys(FORM_SECTIONS);

function toast(msg,type='ok'){ const el=document.createElement('div'); el.className=`toast ${type}`; el.textContent=msg; $('#toast').appendChild(el); setTimeout(()=>el.remove(),4500); }
function slug(s=''){return s.toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90)||crypto.randomUUID();}
function today(){ return new Date().toISOString().slice(0,10); }
function escapeHtml(v=''){return String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function toISODate(v){
  if(!v) return '';
  if(v instanceof Date && !isNaN(v)) return v.toISOString().slice(0,10);
  const raw=String(v||'').trim();
  if(!raw) return '';
  const iso=raw.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if(iso){ const y=iso[1], m=iso[2].padStart(2,'0'), d=iso[3].padStart(2,'0'); return `${y}-${m}-${d}`; }
  const parts=raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
  if(parts){
    let a=Number(parts[1]), b=Number(parts[2]), y=parts[3];
    if(y.length===2) y='20'+y;
    let d=a, m=b;
    // Histórico importado do Excel às vezes vem em padrão americano mm/dd/aaaa.
    // Se a segunda parte for maior que 12, interpretamos como mm/dd/aaaa.
    if(b>12 && a<=12){ m=a; d=b; }
    // Se a primeira parte for maior que 12, mantemos dd/mm/aaaa.
    if(m<1 || m>12 || d<1 || d>31) return '';
    return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  const dt=new Date(raw);
  if(!isNaN(dt)) return dt.toISOString().slice(0,10);
  return '';
}
function formatDateBR(v){ const iso=toISODate(v); if(!iso) return v||''; const [y,m,d]=iso.split('-'); return `${d}/${m}/${y}`; }
function todayBR(){ return formatDateBR(today()); }
function dataRegistroKey(r){
  return toISODate(r?.DATA) || toISODate(r?.['DATA DO REGISTRO']) || toISODate(r?.['DATA REGISTRO']) || toISODate(r?.['DATA DA OCORRÊNCIA']) || toISODate(r?.['Data']) || toISODate(r?.createdAtLocal) || '';
}
function emailsDoAluno(aluno){
  const dados = aluno?.dadosCompletos || {};
  const fromAluno = detectEmailsAluno(aluno||{});
  const fromDados = detectEmailsAluno(dados);
  const emails = [
    ...(Array.isArray(aluno?.emailsResponsaveis) ? aluno.emailsResponsaveis : []),
    ...(Array.isArray(dados?.emailsResponsaveis) ? dados.emailsResponsaveis : []),
    ...fromAluno.emailsResponsaveis,
    ...fromDados.emailsResponsaveis,
    fromAluno.emailMae, fromAluno.emailPai, fromAluno.emailResponsavelAcademico,
    fromDados.emailMae, fromDados.emailPai, fromDados.emailResponsavelAcademico,
    aluno?.emailMae, aluno?.emailPai, aluno?.emailResponsavelAcademico,
    dados?.emailMae, dados?.emailPai, dados?.emailResponsavelAcademico,
    aluno?.emailResponsavel1, aluno?.emailResponsavel2, aluno?.emailResponsavel3,
    dados?.emailResponsavel1, dados?.emailResponsavel2, dados?.emailResponsavel3
  ]
    .flatMap(v=>extrairEmails(v))
    .filter(Boolean)
    .filter((e,i,arr)=>arr.indexOf(e)===i);

  // Fallback: se não encontrar responsáveis, usa qualquer e-mail não institucional de aluno encontrado na ficha.
  if(!emails.length){
    const todos = [...Object.values(aluno||{}), ...Object.values(dados||{})]
      .flatMap(v=>extrairEmails(v))
      .filter(e=>!/@alunosesimg\.com\.br$/i.test(e))
      .filter((e,i,arr)=>arr.indexOf(e)===i);
    return todos;
  }
  return emails;
}
function alunoSelecionado(){ return state.alunos.find(a=>a.id===$('#alunoSelect').value); }
function labelRole(){ return state.profile.role || state.profile.perfil || 'disciplinario'; }
function isAdmin(){ return labelRole()==='admin'; }
function isProfessor(){ return labelRole()==='professor'; }
function isDisciplinario(){ return labelRole()==='disciplinario'; }

function isPedagogia(){ return labelRole()==='pedagogia'; }
function canAccessPage(page){
  const role = labelRole();
  if(role==='admin') return true;
  if(role==='pedagogia') return ['dashboard','novo','professor','historico','alunos'].includes(page);
  if(role==='disciplinario') return ['dashboard','novo','historico'].includes(page);
  if(role==='professor') return ['professor','historico'].includes(page);
  return page==='historico';
}
function canEdit(){
  return ['admin','disciplinario','professor'].includes(labelRole());
}
function applyRolePermissions(){
  const role = labelRole();
  document.body.dataset.role = role;
  $$('.nav').forEach(btn=>{
    const page = btn.dataset.page;
    btn.classList.remove('hidden');
    if(page && !canAccessPage(page)) btn.classList.add('hidden');
  });
  // disable edit areas for pedagogia
  const novoForm = $('#registroForm');
  const profForm = $('#professorForm');
  if(role==='pedagogia'){
    if(novoForm){ novoForm.querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=true); }
    if(profForm){ profForm.querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=true); }
  }
}

function perfilLabel(role=labelRole()){ return ({admin:'admin', disciplinario:'disciplinário', professor:'professor', pedagogia:'pedagogia'}[role] || role); }
function usuarioDisplay(){
  const nome = state.profile?.nome || state.profile?.name || state.user?.displayName || state.user?.email || 'Usuário';
  return `${nome} (${labelRole()})`;
}

function precisaTrocarSenha(){
  return state.profile?.trocarSenhaObrigatoria === true || state.profile?.mustChangePassword === true || state.profile?.senhaInicial === true;
}
function controlarModalSenha(){
  const modal = $('#passwordModal');
  if(!modal) return;
  modal.classList.toggle('hidden', !precisaTrocarSenha());
}
async function trocarSenhaInicial(ev){
  ev.preventDefault();
  const nova = $('#newPassword')?.value || '';
  const confirma = $('#confirmNewPassword')?.value || '';
  if(nova.length < 6){ toast('A nova senha precisa ter pelo menos 6 caracteres.','error'); return; }
  if(nova !== confirma){ toast('As senhas não conferem.','error'); return; }
  try{
    await updatePassword(auth.currentUser, nova);
    await setDoc(doc(db,colecoes.usuarios,state.user.uid),{
      trocarSenhaObrigatoria:false,
      mustChangePassword:false,
      senhaInicial:false,
      senhaAlteradaEm:serverTimestamp(),
      updatedAt:serverTimestamp()
    },{merge:true});
    state.profile.trocarSenhaObrigatoria=false;
    state.profile.mustChangePassword=false;
    state.profile.senhaInicial=false;
    controlarModalSenha();
    toast('Senha alterada com sucesso.');
    $('#changePasswordForm')?.reset();
  }catch(err){
    const msg = err?.code === 'auth/requires-recent-login'
      ? 'Por segurança, saia e entre novamente com a senha padrão para trocar a senha.'
      : (err?.message || err);
    toast('Erro ao trocar senha: '+msg,'error');
  }
}
function registroAutorDisplay(r={}){
  return r.registradoPorDisplay || (r.registradoPorNome ? `${r.registradoPorNome} (${r.registradoPorCargo || 'disciplinario'})` : (r.disciplinario || r.Email || 'Não informado'));
}
function registroEmailInstitucional(){ return 'Registrado pela equipe disciplinar do SESI Dom Bosco.'; }

async function init(){ $('#dataRegistro').value = todayBR(); const pd=$('#profDataRegistro'); if(pd) pd.value=todayBR(); renderCampos(); }
function renderCampos(){
  const box = $('#formCampos'); box.innerHTML='';
  box.insertAdjacentHTML('beforeend', `<div class="forms-question full"><div class="q-label"><span>4.</span> CONTROLE DIÁRIO <b>*</b></div><select name="CONTROLE DIÁRIO" id="controleDiarioSelect" required><option value="">Selecionar sua resposta</option>${CONTROLE_OPTIONS.map(o=>`<option value="${o}">${o}</option>`).join('')}</select></div><div id="controleSection" class="full"></div>`);
  $('#controleDiarioSelect').addEventListener('change', renderControleSection);
}
function renderControleSection(){
  const tipo=$('#controleDiarioSelect')?.value||'';
  const box=$('#controleSection'); if(!box) return;
  box.innerHTML='';
  if(!tipo) return;
  const section=FORM_SECTIONS[tipo];
  const wrap=document.createElement('div'); wrap.className='forms-section';
  wrap.innerHTML=`<h3>${section.titulo}</h3>`;
  section.fields.forEach(field=>wrap.appendChild(renderQuestion(field)));
  box.appendChild(wrap);
}
function renderQuestion(field){
  const q=document.createElement('div'); q.className='forms-question';
  q.innerHTML=`<div class="q-label"><span>${field.n}.</span> ${escapeHtml(field.label).toUpperCase()} ${field.required?'<b>*</b>':''}</div>`;
  if(field.type==='select'){
    const sel=document.createElement('select'); sel.name=field.name; sel.required=!!field.required; sel.innerHTML='<option value="">Selecionar sua resposta</option>'+field.options.map(o=>`<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join(''); q.appendChild(sel);
  }else if(field.type==='textarea'){
    const ta=document.createElement('textarea'); ta.name=field.name; ta.required=!!field.required; ta.placeholder='Insira sua resposta'; q.appendChild(ta);
  }else if(field.type==='datetime-local'){
    const inp=document.createElement('input'); inp.type='datetime-local'; inp.name=field.name; q.appendChild(inp);
  }else if(field.type==='radio'){
    const group=document.createElement('div'); group.className='radio-group';
    field.options.forEach((o,i)=>{ const id=slug(field.name+'-'+o)+'-'+i; group.insertAdjacentHTML('beforeend', `<label class="radio-item" for="${id}"><input id="${id}" type="radio" name="${field.name}" value="${escapeHtml(o)}"> <span>${escapeHtml(o)}</span></label>`);});
    q.appendChild(group);
  }
  return q;
}
function turmas(){ const ts=[...new Set([...TURMAS_FORMS,...state.alunos.map(a=>a.turma).filter(Boolean)])]; return ts.sort((a,b)=>a.localeCompare(b,'pt-BR')); }
function preencherTurmas(){ ['#turmaSelect','#filtroTurma','#profTurmaSelect'].forEach(sel=>{ const el=$(sel); if(!el) return; const old=el.value; el.innerHTML = sel==='#filtroTurma'?'<option value="">Todas</option>':'<option value="">Selecione</option>'; turmas().forEach(t=>el.insertAdjacentHTML('beforeend',`<option>${escapeHtml(t)}</option>`)); el.value=old; }); }
function preencherAlunos(){ const turma=$('#turmaSelect').value; const alunos=state.alunos.filter(a=>!turma||a.turma===turma).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')); $('#alunoSelect').innerHTML='<option value="">Selecione</option>'+alunos.map(a=>`<option value="${a.id}">${escapeHtml(a.nome)}</option>`).join(''); $('#responsaveisBox').textContent='Selecione o aluno para visualizar os e-mails dos responsáveis.'; }
function preencherAlunosProfessor(){ const turma=$('#profTurmaSelect')?.value||''; const alunos=state.alunos.filter(a=>!turma||a.turma===turma).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')); const sel=$('#profAlunoSelect'); if(!sel) return; sel.innerHTML='<option value="">Selecione</option>'+alunos.map(a=>`<option value="${a.id}">${escapeHtml(a.nome)}</option>`).join(''); const box=$('#profAlunoBox'); if(box) box.textContent='Selecione o aluno para visualizar os dados completos.'; }
function alunoSelecionadoProfessor(){ return state.alunos.find(a=>a.id===$('#profAlunoSelect')?.value); }
function atualizarAlunoProfessor(){ const a=alunoSelecionadoProfessor(); const box=$('#profAlunoBox'); if(!a||!box) return; box.innerHTML=`<strong>${escapeHtml(a.nome)}</strong> — ${escapeHtml(a.turma||'')}<br><span class="muted">Registro interno, sem envio de e-mail.</span><br><button type="button" class="mini" id="verAlunoProfessor">Ver aba completa do aluno</button>`; $('#verAlunoProfessor').onclick=()=>abrirAluno(a.id); }

function atualizarResponsaveis(){ const a=alunoSelecionado(); if(!a) return; const emails=emailsDoAluno(a); $('#responsaveisBox').innerHTML = `<strong>${escapeHtml(a.nome)}</strong> — ${escapeHtml(a.turma||'')}<br>E-mails responsáveis: ${emails.length?emails.map(escapeHtml).join(', '):'<span style="color:#b91c1c">não cadastrados</span>'}<br><button type="button" class="mini" id="verAlunoSelecionado">Ver aba completa do aluno</button>`; $('#verAlunoSelecionado').onclick=()=>abrirAluno(a.id); }
async function carregarAlunos(){ const snap=await getDocs(query(collection(db,colecoes.alunos), orderBy('turma'))); state.alunos=snap.docs.map(d=>({id:d.id,...d.data()})); preencherTurmas(); preencherAlunos(); preencherAlunosProfessor(); renderAlunos(); const stat=$('#statAlunos'); if(stat) stat.textContent=state.alunos.length; }
async function carregarConfig(){ const ref=doc(db,colecoes.config,'geral'); const s=await getDoc(ref); state.config=s.exists()?s.data():{}; $('#configCopia').value=state.config.emailCopia||''; $('#configUnidade').value=state.config.unidade||'SESI Dom Bosco'; }
async function salvarConfig(){ await setDoc(doc(db,colecoes.config,'geral'),{emailCopia:$('#configCopia').value.trim(),unidade:$('#configUnidade').value.trim(),updatedAt:serverTimestamp()},{merge:true}); toast('Configurações salvas.'); carregarConfig(); }
async function carregarPerfil(){
  const ref=doc(db,colecoes.usuarios,state.user.uid);
  const s=await getDoc(ref);
  if(s.exists()){
    state.profile=s.data();
  }else{
    // Usuário existe no Authentication, mas foi removido/desautorizado no sistema.
    state.profile={role:'bloqueado', ativo:false};
    toast('Usuário não autorizado ou removido pelo administrador.','error');
    await signOut(auth);
    return;
  }
  if(state.profile.ativo===false){ toast('Usuário desativado. Procure o administrador.','error'); await signOut(auth); return; }
  $('#userLabel').textContent=usuarioDisplay();
  controlarModalSenha();
  $$('.admin-only').forEach(e=>e.style.display=labelRole()==='admin'?'block':'none');
}

function aplicarPermissoes(){
  const role=labelRole();
  $$('.admin-only').forEach(e=>e.style.display=role==='admin'?'block':'none');
  $$('.teacher-only').forEach(e=>e.style.display=(role==='admin'||role==='professor')?'block':'none');
  const novoBtn=document.querySelector('[data-page="novo"]');
  const histBtn=document.querySelector('[data-page="historico"]');
  if(novoBtn) novoBtn.style.display=(role==='admin'||role==='disciplinario'||role==='pedagogia')?'block':'none';
  if(histBtn) histBtn.style.display=(role==='admin'||role==='disciplinario'||role==='pedagogia')?'block':'none';
  if(role==='professor') trocarPagina('professor');
}

function resumoCampos(registro){
  const ignorar=['id','TURMA','ALUNO','DATA','Email','disciplinario','alunoId','emailsResponsaveis','emailCopia','statusEmail','createdAt','createdAtLocal','updatedAt','emailSentAt','emailErro','emailDestino','textoEmail','detalhes_html','alunoDados','registradoPorNome','registradoPorCargo','registradoPorDisplay','emailPedagogia','emailCopiaStatus'];
  return Object.entries(registro).filter(([k,v])=>!ignorar.includes(k)&&v!==undefined&&v!==null&&String(v).trim()!=='').map(([k,v])=>`${k}: ${v}`).join('\n');
}

function detalhesRegistroLista(registro){
  const texto = resumoCampos(registro);
  return texto ? texto.split('\n').filter(Boolean) : [];
}
function detalhesRegistroHtml(registro){
  const itens = detalhesRegistroLista(registro);
  if(!itens.length) return '<p style="margin:0;color:#334155;">Sem detalhes adicionais.</p>';
  return '<ul style="margin:0;padding-left:20px;color:#0f172a;line-height:1.6;">' + itens.map(i=>`<li>${escapeHtml(i)}</li>`).join('') + '</ul>';
}
function logoUrlEmail(){
  try { return new URL('assets/logosesi.png', window.location.href).href; }
  catch(e){ return ''; }
}

function textoEmailAutomatico(registro){
  const tipo=registro['CONTROLE DIÁRIO']||'Registro diário';
  const aluno=registro.ALUNO||'';
  const turma=registro.TURMA||'';
  const data=formatDateBR(registro.DATA)||registro.DATA||'';
  const unidade=state.config.unidade||'SESI Dom Bosco';
  const linhas=[];
  linhas.push(`Prezados responsáveis,`,'');
  if(tipo==='RECONHECIMENTO') linhas.push(`Informamos que foi registrado um reconhecimento referente ao(à) aluno(a) ${aluno}, da turma ${turma}.`);
  else if(tipo==='SAÚDE') linhas.push(`Informamos que foi registrado um atendimento de saúde referente ao(à) aluno(a) ${aluno}, da turma ${turma}.`);
  else if(tipo==='ATRASOS') linhas.push(`Informamos que foi registrado atraso referente ao(à) aluno(a) ${aluno}, da turma ${turma}.`);
  else if(tipo==='SAÍDA ANTECIPADA') linhas.push(`Informamos que foi registrada saída antecipada referente ao(à) aluno(a) ${aluno}, da turma ${turma}.`);
  else if(tipo==='UNIFORME INADEQUADO') linhas.push(`Informamos que foi registrado uso de uniforme inadequado referente ao(à) aluno(a) ${aluno}, da turma ${turma}.`);
  else linhas.push(`Informamos que foi registrado um lançamento no Registro Diário referente ao(à) aluno(a) ${aluno}, da turma ${turma}.`);
  linhas.push('',`Data: ${data}`,`Tipo de registro: ${tipo}`,'','Detalhes do registro:',resumoCampos(registro)||'Sem detalhes adicionais.','','Atenciosamente,',`Equipe disciplinar - ${unidade}`);
  return linhas.join('\n');
}
async function salvarRegistro(ev){ if(!['admin','disciplinario'].includes(labelRole())){ ev?.preventDefault?.(); toast('Você não tem permissão para criar registro disciplinar.','error'); return; } ev.preventDefault(); const aluno=alunoSelecionado(); if(!aluno){ toast('Selecione um aluno.','error'); return; }
  const dados={}; new FormData($('#registroForm')).forEach((v,k)=>dados[k]=v);
  const emails=emailsDoAluno(aluno);
  const registro={...dados,TURMA:aluno.turma,ALUNO:aluno.nome,DATA:toISODate($('#dataRegistro').value)||$('#dataRegistro').value,Email:state.user.email,disciplinario:state.user.email,registradoPorNome:state.profile?.nome||state.user.email,registradoPorCargo:labelRole(),registradoPorDisplay:usuarioDisplay(),alunoId:aluno.id,alunoDados:aluno.dadosCompletos||aluno,emailsResponsaveis:emails,emailCopia:state.config.emailCopia||'',statusEmail:emails.length?'pendente':'sem-email',createdAt:serverTimestamp(),createdAtLocal:new Date().toISOString()};
  registro.textoEmail = textoEmailAutomatico(registro);
  const ref=await addDoc(collection(db,colecoes.ocorrencias),registro);
  await tentarEmailJs(registro,ref.id);
  toast(emails.length?'Registro salvo. E-mail será enviado aos responsáveis.':'Registro salvo, mas o aluno não tem e-mail de responsável cadastrado.');
  $('#registroForm').reset(); renderControleSection(); atualizarHistorico();
}
async function tentarEmailJs(registro,id){
  if(!emailJsConfig.enabled || !window.emailjs){
    await setDoc(doc(db,colecoes.ocorrencias,id),{statusEmail:'emailjs-desativado'},{merge:true});
    return;
  }
  const destinatarios=(registro.emailsResponsaveis||[]).map(e=>String(e||'').trim()).filter(e=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  if(!destinatarios.length){
    await setDoc(doc(db,colecoes.ocorrencias,id),{statusEmail:'sem-email-mae',emailErro:'Aluno sem E-MAIL MÃE válido.'},{merge:true});
    return;
  }
  const detalhes = resumoCampos(registro) || 'Registro diário sem detalhes adicionais.';
  const observacoes = registro['PROVIDÊNCIA'] || registro['CONTATO COM RESPONSÁVEIS'] || registro['COMUNICADO À FAMÍLIA'] || registro['SANÇÕES'] || '';
  const params={
    // Variáveis usadas no template do EmailJS
    to_email: destinatarios.join(','),
    cc_email: (registro.emailCopia || '').trim(),
    reply_to: state.user?.email || 'naoresponder@sesi.local',
    name: 'SESI Dom Bosco',
    logo_url: logoUrlEmail(),
    detalhes_html: detalhesRegistroHtml(registro),
    aluno_nome: registro.ALUNO || '',
    turma: registro.TURMA || '',
    controle_diario: registro['CONTROLE DIÁRIO'] || 'Registro diário',
    data_registro: formatDateBR(registro.DATA) || registro.DATA || '',
    detalhes_registro: detalhes,
    observacoes: observacoes,
    registrado_por: registroEmailInstitucional(),
    // Variáveis extras para compatibilidade com modelos padrão do EmailJS
    email: state.user?.email || 'naoresponder@sesi.local',
    message: detalhes,
    subject: `Registro Diário - ${registro.ALUNO || ''} - ${registro['CONTROLE DIÁRIO'] || ''}`
  };
  try{
    console.log('EmailJS params', params);
    await emailjs.send(emailJsConfig.serviceId,emailJsConfig.templateId,params,{publicKey:emailJsConfig.publicKey});
    await setDoc(doc(db,colecoes.ocorrencias,id),{statusEmail:'enviado-emailjs',emailSentAt:serverTimestamp(),emailDestino:params.to_email,emailPedagogia:params.cc_email||''},{merge:true});
  }catch(e){
    const erro = e?.text || e?.message || JSON.stringify(e) || String(e);
    console.error('Erro EmailJS:', e, 'Params:', params);
    await setDoc(doc(db,colecoes.ocorrencias,id),{statusEmail:'erro-emailjs',emailErro:erro,emailDestino:params.to_email,emailPedagogia:params.cc_email||''},{merge:true});
    toast('Erro ao enviar e-mail: '+erro,'error');
  }
}

async function salvarRegistroProfessor(ev){ if(!['admin','professor'].includes(labelRole())){ ev?.preventDefault?.(); toast('Você não tem permissão para criar registro do professor.','error'); return; }
  ev.preventDefault();
  const aluno=alunoSelecionadoProfessor();
  if(!aluno){ toast('Selecione um aluno.','error'); return; }
  const dados={}; new FormData($('#professorForm')).forEach((v,k)=>dados[k]=v);
  const registro={
    ...dados,
    origem:'professor',
    tipoRegistro:'professor-sala',
    'CONTROLE DIÁRIO':'OCORRÊNCIA PROFESSOR',
    TURMA:aluno.turma,
    ALUNO:aluno.nome,
    DATA:toISODate($('#profDataRegistro').value)||$('#profDataRegistro').value,
    Email:state.user.email,
    disciplinario:state.user.email,
    registradoPorNome:state.profile?.nome||state.user.email,
    registradoPorCargo:labelRole(),
    registradoPorDisplay:usuarioDisplay(),
    alunoId:aluno.id,
    alunoDados:aluno.dadosCompletos||aluno,
    statusEmail:'não enviado - registro de professor',
    emailErro:'Registro interno. Não envia e-mail aos responsáveis.',
    createdAt:serverTimestamp(),
    createdAtLocal:new Date().toISOString()
  };
  registro.textoEmail='Registro interno de professor. Não há envio de e-mail.';
  await addDoc(collection(db,colecoes.ocorrencias),registro);
  toast('Registro do professor salvo no histórico do aluno. Nenhum e-mail foi enviado.');
  $('#professorForm').reset();
  const pn=$('#professorNome'); if(pn) pn.value=state.profile.nome || state.user.email;
  atualizarAlunoProfessor();
  atualizarHistorico();
}

async function atualizarHistorico(){ const snap=await getDocs(query(collection(db,colecoes.ocorrencias), orderBy('createdAtLocal','desc'), limit(5000))); state.historico=snap.docs.map(d=>({id:d.id,...d.data()})); renderHistorico(); const sr=$('#statRegistros'); if(sr) sr.textContent=state.historico.length; const se=$('#statEmails'); if(se) se.textContent=state.historico.filter(r=>['pendente','enviado-cloud','enviado-emailjs'].includes(r.statusEmail)).length; preencherDashboardTurmas(); renderDashboard(); }

function origemRegistro(r){
  return r.origem==='professor' || r.tipoRegistro==='professor-sala' || r['CONTROLE DIÁRIO']==='OCORRÊNCIA PROFESSOR' ? 'professor' : 'disciplinar';
}
function dashboardRegistrosFiltrados(){
  const ini=$('#dashInicio')?.value||'', fim=$('#dashFim')?.value||'', turma=$('#dashTurma')?.value||'', origem=$('#dashOrigem')?.value||'';
  return state.historico.filter(r=>
    (!toISODate(ini) || dataRegistroKey(r)>=toISODate(ini)) &&
    (!toISODate(fim) || dataRegistroKey(r)<=toISODate(fim)) &&
    (!turma || r.TURMA===turma) &&
    (!origem || origemRegistro(r)===origem)
  );
}
function contarPor(lista, getter){
  const map=new Map();
  lista.forEach(r=>{
    const k=(getter(r)||'Não informado').toString().trim()||'Não informado';
    map.set(k,(map.get(k)||0)+1);
  });
  return [...map.entries()].map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value);
}
function mesRegistro(r){
  const d=dataRegistroKey(r);
  if(!/^\d{4}-\d{2}/.test(d)) return 'Sem data';
  const [y,m]=d.split('-'); return `${m}/${y}`;
}
function corIndicador(label=''){
  return '#004a98';
}
function chartBars(elId, data, maxItems=10){
  const el=$('#'+elId); if(!el) return;
  const rows=(data||[]).slice(0,maxItems);
  if(!rows.length){ el.innerHTML='<p class="muted">Sem dados para exibir.</p>'; return; }
  const max=Math.max(...rows.map(r=>r.value),1);
  el.innerHTML=rows.map(r=>`<div class="bar-row"><span class="bar-label" title="${escapeHtml(r.label)}">${escapeHtml(r.label)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(4,(r.value/max)*100)}%"></div></div><strong>${r.value}</strong></div>`).join('');
}
function chartTimeline(elId, data){
  const el=$('#'+elId); if(!el) return;
  const rows=[...(data||[])].sort((a,b)=>{ const ka=a.label==='Sem data'?'0000-00':a.label.split('/').reverse().join('-'); const kb=b.label==='Sem data'?'0000-00':b.label.split('/').reverse().join('-'); return ka.localeCompare(kb); }).slice(-12);
  if(!rows.length){ el.innerHTML='<p class="muted">Sem dados para exibir.</p>'; return; }
  const max=Math.max(...rows.map(r=>r.value),1);
  el.innerHTML=`<div class="mini-line">${rows.map(r=>`<div class="line-col"><div class="line-bar" style="height:${Math.max(8,(r.value/max)*130)}px"></div><small>${escapeHtml(r.label)}</small><strong>${r.value}</strong></div>`).join('')}</div>`;
}
function preencherDashboardTurmas(){
  const sel=$('#dashTurma'); if(!sel) return;
  const old=sel.value;
  sel.innerHTML='<option value="">Todas</option>';
  turmas().forEach(t=>sel.insertAdjacentHTML('beforeend',`<option>${escapeHtml(t)}</option>`));
  sel.value=old;
}
function abrirHistoricoAlunoDashboard(nome,turma){
  trocarPagina('historico');
  if($('#filtroBusca')) $('#filtroBusca').value = nome || '';
  if($('#filtroTurma')) $('#filtroTurma').value = turma || '';
  renderHistorico();
}

function renderDashboard(){
  if(!$('#page-dashboard')) return;
  if(!canAccessPage('dashboard')) return;
  const lista=dashboardRegistrosFiltrados();
  const alunosUnicos=new Set(lista.map(r=>`${r.ALUNO||''}|${r.TURMA||''}`).filter(x=>x.trim()!=='|')).size;
  const professor=lista.filter(r=>origemRegistro(r)==='professor').length;
  const disciplinar=lista.filter(r=>origemRegistro(r)==='disciplinar').length;
  const reconhecimentos=lista.filter(r=>norm(r['CONTROLE DIÁRIO']).includes('reconhecimento')).length;
  const saude=lista.filter(r=>norm(r['CONTROLE DIÁRIO']).includes('saude')).length;
  const porTurma=contarPor(lista,r=>r.TURMA);
  const porAluno=contarPor(lista,r=>r.ALUNO);
  const cards=[
    ['Total de registros', lista.length],
    ['Alunos com registros', alunosUnicos],
    ['Registro diário', disciplinar],
    ['Registros professor', professor],
    ['Reconhecimentos', reconhecimentos],
    ['Saúde', saude],
    ['Turma com mais registros', porTurma[0]?`${porTurma[0].label} (${porTurma[0].value})`:'-'],
    ['Aluno com mais registros', porAluno[0]?`${porAluno[0].label} (${porAluno[0].value})`:'-']
  ];
  const cardsEl=$('#dashboardCards');
  if(cardsEl) cardsEl.innerHTML=cards.map(([t,v])=>`<div class="dash-card"><span>${escapeHtml(t)}</span><strong>${escapeHtml(v)}</strong></div>`).join('');
  chartBars('chartTipo', contarPor(lista,r=>r['CONTROLE DIÁRIO']||r.tipoRegistro||'Registro'), 10);
  chartTimeline('chartMes', contarPor(lista, mesRegistro));
  chartBars('chartAlunos', porAluno, 10);
  chartBars('chartTurmas', porTurma, 10);
  chartBars('chartItensProfessor', contarPor(lista.filter(r=>origemRegistro(r)==='professor'), r=>r['ITEM DE REFERÊNCIA']||r['ITEM DE REFERENCIA']||r.ITEM), 10);
  chartBars('chartProfessores', contarPor(lista.filter(r=>origemRegistro(r)==='professor'), r=>r.PROFESSOR || r.professor || r.registradoPorNome || r.registradoPorDisplay || r.Email), 10);
  const sancoes = lista.filter(r=>r['SANÇÕES']||r['SANCOES']||r['NATUREZA']);
  chartBars('chartSancoes', contarPor(sancoes, r=>r['SANÇÕES']||r['SANCOES']||r['NATUREZA']), 8);
  const table=$('#dashboardTabelaAlunos');
  if(table){
    const rows=porAluno.slice(0,20).map(a=>{
      const regs=lista.filter(r=>(r.ALUNO||'')===a.label).sort((x,y)=>String(dataRegistroKey(y)).localeCompare(String(dataRegistroKey(x))));
      const ultimo=regs[0]||{};
      const tipo=contarPor(regs,r=>r['CONTROLE DIÁRIO']||r.tipoRegistro||'Registro')[0]?.label||'-';
      return `<tr><td>${escapeHtml(a.label)}</td><td>${escapeHtml(ultimo.TURMA||'-')}</td><td>${a.value}</td><td>${escapeHtml(tipo)}</td><td>${escapeHtml(formatDateBR(dataRegistroKey(ultimo))||'-')}</td><td><button type="button" class="mini dash-ver-registros" data-aluno="${escapeHtml(a.label)}" data-turma="${escapeHtml(ultimo.TURMA||'')}">Ver registros</button></td></tr>`;
    }).join('');
    table.innerHTML=`<table class="dash-table"><thead><tr><th>Aluno</th><th>Turma</th><th>Total</th><th>Tipo mais frequente</th><th>Último registro</th><th>Ação</th></tr></thead><tbody>${rows||'<tr><td colspan="6">Sem dados.</td></tr>'}</tbody></table>`;
    $$('.dash-ver-registros').forEach(btn=>btn.onclick=()=>abrirHistoricoAlunoDashboard(btn.dataset.aluno, btn.dataset.turma));
  }
}

function renderHistorico(){ const busca=$('#filtroBusca').value.toLowerCase(), turma=$('#filtroTurma').value, ini=$('#filtroInicio').value, fim=$('#filtroFim').value; let lista=state.historico.filter(r=>(!turma||r.TURMA===turma)&&(!toISODate(ini)||dataRegistroKey(r)>=toISODate(ini))&&(!toISODate(fim)||dataRegistroKey(r)<=toISODate(fim)));  if(busca) lista=lista.filter(r=>JSON.stringify(r).toLowerCase().includes(busca)); $('#listaHistorico').innerHTML=lista.map(r=>`<article class="item clickable" data-registro="${r.id}"><h4>${escapeHtml(r.ALUNO||'')}</h4><p><strong>Turma:</strong> ${escapeHtml(r.TURMA||'')} • <strong>Data:</strong> ${escapeHtml(formatDateBR(dataRegistroKey(r))||'')} • <strong>Registrado por:</strong> ${escapeHtml(registroAutorDisplay(r))}</p><p>${escapeHtml(r['DESCREVA O OCORRIDO']||r['DESCREVA O RECONHECIMENTO']||r['MOTIVO']||r['SINTOMAS']||'Clique para ver todas as informações do registro.')}</p><div class="badges"><span class="badge">${escapeHtml(r['CONTROLE DIÁRIO']||'Registro')}</span>${r.origem==='professor'?'<span class="badge">Registro professor</span>':`<span class="badge">E-mail: ${escapeHtml(r.statusEmail||'não informado')}</span>`}</div></article>`).join('') || '<div class="card">Nenhum registro encontrado.</div>'; $$('[data-registro]').forEach(el=>el.onclick=()=>abrirRegistro(el.dataset.registro)); }
function renderAlunos(){ $('#listaAlunos').innerHTML=state.alunos.slice(0,700).map(a=>`<div class="item clickable" data-aluno="${a.id}"><h4>${escapeHtml(a.nome)}</h4><p>${escapeHtml(a.turma||'')}</p><p>${emailsDoAluno(a).map(escapeHtml).join(', ')||'Sem e-mail cadastrado'}</p><div class="badges"><span class="badge">Ver aba completa</span></div></div>`).join(''); $$('[data-aluno]').forEach(el=>el.onclick=()=>abrirAluno(el.dataset.aluno)); }
function keyValuesTable(obj){ const rows=Object.entries(obj||{}).filter(([k,v])=>!['id','dadosCompletos'].includes(k)&&v!==undefined&&v!==null&&String(v).trim()!=='' ); return `<div class="detail-grid">${rows.map(([k,v])=>`<div><strong>${escapeHtml(k)}</strong><span>${escapeHtml(v)}</span></div>`).join('')}</div>`; }
function canon(v=''){ return norm(v).replace(/[^a-z0-9]/g,''); }
function alunoNomeCandidatos(a={}){
  const d=a.dadosCompletos||{};
  return [a.nome,a.ALUNO,a.NOME,a['NOME DO ALUNO'],a['ALUNO NOME'],d.ALUNO,d.NOME,d['NOME DO ALUNO'],d['ALUNO NOME']].filter(Boolean).map(canon);
}
function alunoTurmaCandidatos(a={}){
  const d=a.dadosCompletos||{};
  return [a.turma,a.TURMA,a['CODIGO TURMA'],a['CÓDIGO TURMA'],d.TURMA,d['CODIGO TURMA'],d['CÓDIGO TURMA']].filter(Boolean).map(canon);
}
function alunoRaCandidatos(a={}){
  const d=a.dadosCompletos||{};
  return [a.raAluno,a.RA,a['RA ALUNO'],a['MATRÍCULA'],a.MATRICULA,d.RA,d['RA ALUNO'],d['MATRÍCULA'],d.MATRICULA].filter(Boolean).map(canon);
}
function registroAlunoCandidatos(r={}){
  return [r.ALUNO,r.NOME,r['NOME DO ALUNO'],r['ALUNO NOME'],r.alunoNome,r.aluno_nome,r.alunoDados?.nome,r.alunoDados?.ALUNO,r.alunoDados?.NOME,r.alunoDados?.['NOME DO ALUNO'],r.alunoDados?.['ALUNO NOME']].filter(Boolean).map(canon);
}
function registroTurmaCandidatos(r={}){
  return [r.TURMA,r['CODIGO TURMA'],r['CÓDIGO TURMA'],r.turma,r.alunoDados?.turma,r.alunoDados?.TURMA,r.alunoDados?.['CODIGO TURMA'],r.alunoDados?.['CÓDIGO TURMA']].filter(Boolean).map(canon);
}
function registroRaCandidatos(r={}){
  return [r.raAluno,r.RA,r['RA ALUNO'],r['MATRÍCULA'],r.MATRICULA,r.alunoDados?.raAluno,r.alunoDados?.RA,r.alunoDados?.['RA ALUNO'],r.alunoDados?.['MATRÍCULA'],r.alunoDados?.MATRICULA].filter(Boolean).map(canon);
}
function pertenceAoAluno(registro={}, aluno={}){
  if(registro.alunoId && registro.alunoId===aluno.id) return true;
  const raAluno=alunoRaCandidatos(aluno), raReg=registroRaCandidatos(registro);
  if(raAluno.length && raReg.some(x=>raAluno.includes(x))) return true;
  const nomes=alunoNomeCandidatos(aluno), nomesReg=registroAlunoCandidatos(registro);
  if(!nomes.length || !nomesReg.some(x=>nomes.includes(x))) return false;
  const turmas=alunoTurmaCandidatos(aluno), turmasReg=registroTurmaCandidatos(registro);
  return !turmas.length || !turmasReg.length || turmasReg.some(x=>turmas.includes(x));
}
function abrirAluno(id){ const a=state.alunos.find(x=>x.id===id); if(!a) return; state.alunoAberto=a; const regs=state.historico.filter(r=>pertenceAoAluno(r,a)); $('#modalTitle').textContent='Aba do aluno'; $('#modalBody').innerHTML=`<h3>${escapeHtml(a.nome)}</h3><p class="muted">${escapeHtml(a.turma||'')} • ${emailsDoAluno(a).map(escapeHtml).join(', ')||'Sem e-mail cadastrado'}</p><h4>Informações completas da planilha SQL</h4>${keyValuesTable(a.dadosCompletos||a)}<h4>Registros deste aluno</h4>${regs.length?regs.map(r=>`<div class="mini-card" data-modal-registro="${r.id}"><strong>${escapeHtml(formatDateBR(dataRegistroKey(r))||'')}</strong> — ${escapeHtml(r['CONTROLE DIÁRIO']||'Registro')}<br><span>${escapeHtml(r['DESCREVA O OCORRIDO']||r['DESCREVA O RECONHECIMENTO']||r['MOTIVO']||'Clique para abrir')}</span></div>`).join(''):'<p>Nenhum registro encontrado para este aluno.</p>'}`; abrirModal(); $$('[data-modal-registro]').forEach(el=>el.onclick=()=>abrirRegistro(el.dataset.modalRegistro)); }
function abrirRegistro(id){ const r=state.historico.find(x=>x.id===id); if(!r) return; $('#modalTitle').textContent='Detalhes do registro'; const aluno=state.alunos.find(a=>a.id===r.alunoId); const podeApagar=labelRole()==='admin'; $('#modalBody').innerHTML=`<h3>${escapeHtml(r.ALUNO||'')}</h3><p class="muted">${escapeHtml(r.TURMA||'')} • ${escapeHtml(formatDateBR(dataRegistroKey(r))||'')} • Registrado por: ${escapeHtml(registroAutorDisplay(r))}</p><div class="badges"><span class="badge">${escapeHtml(r['CONTROLE DIÁRIO']||'Registro')}</span>${r.origem==='professor'?'<span class="badge">Sem envio de e-mail</span>':`<span class="badge">${escapeHtml(r.statusEmail||'sem status')}</span>`}${r.emailPedagogia?`<span class="badge">Pedagogia: ${escapeHtml(r.emailPedagogia)}</span>`:''}</div>${podeApagar?`<div class="actions"><button type="button" class="danger" id="apagarRegistroBtn" data-id="${escapeHtml(r.id)}">Apagar registro</button></div>`:''}<h4>Informações do registro</h4>${keyValuesTable(r)}<h4>Texto automático do e-mail</h4><pre class="email-preview">${escapeHtml(r.textoEmail||textoEmailAutomatico(r))}</pre>${aluno?`<h4>Dados do aluno na planilha SQL</h4>${keyValuesTable(aluno.dadosCompletos||aluno)}`:''}`; abrirModal(); const btn=$('#apagarRegistroBtn'); if(btn) btn.onclick=()=>apagarRegistro(btn.dataset.id); }
async function apagarRegistro(id){
  if(labelRole()!=='admin'){ toast('Apenas administradores podem apagar registros.','error'); return; }
  if(!confirm('Deseja realmente apagar este registro?')) return;
  try{
    await deleteDoc(doc(db,colecoes.ocorrencias,id));
    state.historico = state.historico.filter(r=>r.id!==id);
    fecharModal();
    renderHistorico();
    toast('Registro apagado com sucesso.');
  }catch(err){ toast('Erro ao apagar registro: '+(err?.message||err),'error'); }
}
function abrirModal(){ $('#detailModal').classList.add('open'); }
function fecharModal(){ $('#detailModal').classList.remove('open'); }
async function salvarAluno(){ const nome=$('#alunoNome').value.trim(), turma=$('#alunoTurma').value.trim(); if(!nome||!turma){toast('Informe nome e turma.','error');return;} const id=slug(`${turma}-${nome}`); await setDoc(doc(db,colecoes.alunos,id),{nome,turma,emailResponsavel1:$('#alunoResp1').value.trim(),emailResponsavel2:$('#alunoResp2').value.trim(),telefoneResponsavel:$('#alunoTel').value.trim(),ativo:true,updatedAt:serverTimestamp()},{merge:true}); toast('Aluno salvo.'); ['#alunoNome','#alunoTurma','#alunoResp1','#alunoResp2','#alunoTel'].forEach(s=>$(s).value=''); await carregarAlunos(); }
async function gravarListaImportada(colecao,lista,mapper){
  let batch=writeBatch(db), count=0, lote=0;
  for(const item of lista){
    const mapped=mapper(item);
    const ref=doc(db,colecao,mapped.id||slug(JSON.stringify(mapped).slice(0,80)));
    delete mapped.id;
    batch.set(ref,{...mapped,importadoEm:serverTimestamp()},{merge:true});
    count++; lote++;
    if(lote===400){ await batch.commit(); batch=writeBatch(db); lote=0; toast(`${count} importados...`); }
  }
  if(lote) await batch.commit();
  toast(`${count} registros importados.`);
  return count;
}
async function importarJson(path,colecao,mapper){ const data=await fetch(path).then(r=>r.json()); return gravarListaImportada(colecao,data,mapper); }
async function importarAlunos(){
  await importarJson('data/alunos-seed.json',colecoes.alunos,mapAlunoImportado);
  await carregarAlunos();
}
async function importarHistorico(){ await importarJson('data/registros-historicos-seed.json',colecoes.ocorrencias,mapHistoricoImportado); await atualizarHistorico(); }
async function importarAlunosArquivo(){
  try{
    if(labelRole()!=='admin'){ toast('Apenas administradores podem importar alunos.','error'); return; }
    const rows = await lerPlanilhaArquivo($('#arquivoAlunosSql'));
    if(!rows.length){ toast('A planilha não possui linhas para importar.','error'); return; }
    await gravarListaImportada(colecoes.alunos, rows, mapAlunoImportado,{arquivoImportado:$('#arquivoAlunosSql')?.files?.[0]?.name||''});
    await carregarAlunos();
  }catch(err){ toast('Erro ao importar alunos: '+(err?.message||err),'error'); }
}
async function importarHistoricoArquivo(){
  try{
    if(labelRole()!=='admin'){ toast('Apenas administradores podem importar histórico.','error'); return; }
    const rows = await lerPlanilhaArquivo($('#arquivoHistorico'));
    if(!rows.length){ toast('A planilha não possui linhas para importar.','error'); return; }
    await gravarListaImportada(colecoes.ocorrencias, rows, mapHistoricoImportado);
    await atualizarHistorico();
  }catch(err){ toast('Erro ao importar histórico: '+(err?.message||err),'error'); }
}
async function limparBancoDados(){
  if(!confirm('Deseja realmente apagar TODOS os dados do banco? Esta ação remove alunos, registros e usuários extras.')) return;
  const colunas=[colecoes.ocorrencias, colecoes.alunos];
  for(const c of colunas){
    const snap=await getDocs(collection(db,c)); let batch=writeBatch(db),i=0;
    for(const d of snap.docs){ batch.delete(d.ref); i++; if(i%400===0){ await batch.commit(); batch=writeBatch(db);} }
    if(i%400!==0) await batch.commit();
  }
  toast('Banco de dados limpo.');
  state.alunos=[]; state.historico=[]; renderAlunos(); renderHistorico();
}
function exportarCsv(){ const rows=state.historico; if(!rows.length){toast('Nada para exportar.','error');return;} const cols=[...new Set(rows.flatMap(r=>Object.keys(r)))]; const csv=[cols.join(';'),...rows.map(r=>cols.map(c=>`"${String(r[c]??'').replace(/"/g,'""')}"`).join(';'))].join('\n'); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); a.download='registro-diario-ocorrencias.csv'; a.click(); }


function aplicarMascaraDataBR(input){
  if(!input) return;
  input.addEventListener('input',()=>{
    let v=input.value.replace(/\D/g,'').slice(0,8);
    if(v.length>=5) v=v.replace(/(\d{2})(\d{2})(\d{1,4})/,'$1/$2/$3');
    else if(v.length>=3) v=v.replace(/(\d{2})(\d{1,2})/,'$1/$2');
    input.value=v;
  });
}
function aplicarMascarasData(){ ['#dataRegistro','#profDataRegistro','#filtroInicio','#filtroFim','input[name="DATA DA OCORRÊNCIA"]'].forEach(sel=>document.querySelectorAll(sel).forEach(aplicarMascaraDataBR)); }

function paginaInicialPorPerfil(){
  if(canAccessPage('dashboard')) return 'dashboard';
  if(canAccessPage('professor')) return 'professor';
  if(canAccessPage('novo')) return 'novo';
  return 'historico';
}

function trocarPagina(p){
  if(!canAccessPage(p)){ toast('Você não tem permissão para acessar esta área.','error'); p = canAccessPage('historico') ? 'historico' : (canAccessPage('novo')?'novo':'professor'); }
  $$('.nav').forEach(b=>b.classList.toggle('active',b.dataset.page===p));
  $$('.page').forEach(s=>s.classList.toggle('active',s.id===`page-${p}`));
  $('#pageTitle').textContent={novo:'Novo registro',professor:'Registro professor',historico:'Histórico',dashboard:'Dashboard',alunos:'Alunos',admin:'Admin'}[p]||'Registro';
  $('.sidebar').classList.remove('open');
  if(p==='historico') atualizarHistorico();
  if(p==='dashboard') renderDashboard();
  if(p==='alunos') renderAlunos();
  if(p==='admin') carregarUsuarios();
}
async function carregarUsuarios(){
  if(labelRole()!=='admin') return;
  const snap = await getDocs(collection(db,colecoes.usuarios));
  state.allUsuarios = snap.docs.map(d=>({id:d.id,...d.data()}));
  const box = $('#listaUsuarios');
  if(box){
    box.innerHTML = state.allUsuarios.map(u=>`<div class="item"><h4>${escapeHtml(u.nome||u.email||'Usuário')}</h4><p>${escapeHtml(u.email||'')} • ${escapeHtml(u.role||u.perfil||'disciplinario')} • ${u.ativo===false?'inativo':'ativo'}${(u.trocarSenhaObrigatoria||u.senhaInicial)?' • troca de senha pendente':''}</p><div class="actions">${u.id===state.user.uid?'<span class="muted">Usuário atual</span>':`<button type="button" class="danger mini" data-delete-user="${escapeHtml(u.id)}">Deletar usuário</button>`}</div></div>`).join('') || '<p class="muted">Nenhum usuário listado.</p>';
    $$('[data-delete-user]').forEach(btn=>btn.onclick=()=>deletarUsuario(btn.dataset.deleteUser));
  }
}
async function deletarUsuario(uid){
  if(labelRole()!=='admin'){ toast('Apenas administradores podem deletar usuários.','error'); return; }
  if(uid===state.user.uid){ toast('Você não pode deletar seu próprio usuário logado.','error'); return; }
  const u=state.allUsuarios.find(x=>x.id===uid) || {};
  if(!confirm(`Deseja realmente deletar o usuário ${u.nome||u.email||uid}?

Ele será removido do acesso ao sistema.`)) return;
  try{
    await deleteDoc(doc(db,colecoes.usuarios,uid));
    state.allUsuarios=state.allUsuarios.filter(x=>x.id!==uid);
    await carregarUsuarios();
    toast('Usuário deletado do sistema.');
  }catch(err){ toast('Erro ao deletar usuário: '+(err?.message||err),'error'); }
}
async function criarUsuarioAdmin(ev){
  ev.preventDefault();
  if(labelRole()!=='admin'){ toast('Apenas administradores podem criar usuários.','error'); return; }
  const nome=$('#adminUserNome').value.trim();
  const email=$('#adminUserEmail').value.trim();
  const senha=$('#adminUserSenhaPadrao').value;
  const role=$('#adminUserPerfil').value;
  if(!nome || !email || senha.length<6){ toast('Informe nome, e-mail e senha padrão com pelo menos 6 caracteres.','error'); return; }
  let secondaryApp=null;
  try{
    secondaryApp = initializeApp(firebaseConfig, 'secondary-'+Date.now());
    const secondaryAuth = getAuth(secondaryApp);
    const cred = await createUserWithEmailAndPassword(secondaryAuth,email,senha);
    await setDoc(doc(db,colecoes.usuarios,cred.user.uid),{nome,email,role,ativo:true,trocarSenhaObrigatoria:true,senhaInicial:true,createdAt:serverTimestamp(),criadoPor:state.user.email},{merge:true});
    toast('Usuário criado com sucesso. Ele deverá trocar a senha no primeiro acesso.');
    $('#adminUserForm').reset();
    if($('#adminUserSenhaPadrao')) $('#adminUserSenhaPadrao').value='Sesi@123456';
    await carregarUsuarios();
  }catch(err){
    toast('Erro ao criar usuário: '+(err?.message||err),'error');
  }finally{
    if(secondaryApp) try{ await deleteApp(secondaryApp); }catch(e){}
  }
}

aplicarMascarasData();
$('#loginForm').addEventListener('submit',async e=>{ e.preventDefault(); try{ await signInWithEmailAndPassword(auth,$('#loginEmail').value,$('#loginPassword').value); }catch(err){toast('Erro no login: '+err.message,'error')} });
if($('#changePasswordForm')) $('#changePasswordForm').addEventListener('submit',trocarSenhaInicial);
$('#logoutBtn').onclick=()=>signOut(auth); $('#menuBtn').onclick=()=>$('.sidebar').classList.toggle('open'); $$('.nav').forEach(b=>b.onclick=()=>trocarPagina(b.dataset.page));
$('#turmaSelect').onchange=preencherAlunos; $('#alunoSelect').onchange=atualizarResponsaveis; if($('#profTurmaSelect')) $('#profTurmaSelect').onchange=preencherAlunosProfessor; if($('#profAlunoSelect')) $('#profAlunoSelect').onchange=atualizarAlunoProfessor; $('#registroForm').onsubmit=salvarRegistro; if($('#professorForm')) $('#professorForm').onsubmit=salvarRegistroProfessor; $('#limparForm').onclick=()=>{ $('#registroForm').reset(); renderControleSection(); }; if($('#limparProfessorForm')) $('#limparProfessorForm').onclick=()=>{ $('#professorForm').reset(); const pn=$('#professorNome'); if(pn) pn.value=state.profile.nome || state.user.email; }; $('#aplicarFiltros').onclick=renderHistorico; $('#exportarCsv').onclick=exportarCsv; if($('#atualizarDashboard')) $('#atualizarDashboard').onclick=renderDashboard; if($('#limparDashboard')) $('#limparDashboard').onclick=()=>{ ['#dashInicio','#dashFim','#dashOrigem'].forEach(s=>{ if($(s)) $(s).value=''; }); if($('#dashTurma')) $('#dashTurma').value=''; renderDashboard(); }; $('#salvarAluno').onclick=salvarAluno; $('#importarAlunos').onclick=importarAlunos; $('#importarHistorico').onclick=importarHistorico; $('#importarAlunosArquivo').onclick=importarAlunosArquivo; $('#importarHistoricoArquivo').onclick=importarHistoricoArquivo; $('#adminUserForm').addEventListener('submit',criarUsuarioAdmin); $('#salvarConfig').onclick=salvarConfig; $('#limparBanco').onclick=limparBancoDados; $('#modalClose').onclick=fecharModal; $('#modalBackdrop').onclick=fecharModal;
onAuthStateChanged(auth,async user=>{ state.user=user; $('#loginScreen').classList.toggle('hidden',!!user); $('#app').classList.toggle('hidden',!user); if(user){ await init(); await carregarPerfil(); applyRolePermissions(); await carregarConfig(); await carregarAlunos(); await atualizarHistorico(); trocarPagina(paginaInicialPorPerfil()); } });
