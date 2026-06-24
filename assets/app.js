import { firebaseConfig, emailJsConfig } from '../firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, setDoc, addDoc, getDocs, query, where, orderBy, limit, serverTimestamp, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const state = { user:null, profile:{role:'disciplinario'}, alunos:[], campos:[], historico:[], config:{} };
const camposAuto = ['ID','Hora de início','Hora de conclusão','Email','Nome','Hora da última modificação','TURMA','ALUNO','DATA'];
const camposLongos = ['DESCREVA O OCORRIDO','DESCREVA O OCORRIDO 2','DESCREVA O RECONHECIMENTO','COMUNICADO À FAMÍLIA'];
const colecoes = { alunos:'alunos', ocorrencias:'ocorrencias', usuarios:'usuarios', config:'configuracoes' };

function toast(msg,type='ok'){ const el=document.createElement('div'); el.className=`toast ${type}`; el.textContent=msg; $('#toast').appendChild(el); setTimeout(()=>el.remove(),4500); }
function slug(s=''){return s.toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90)||crypto.randomUUID();}
function today(){ return new Date().toISOString().slice(0,10); }
function emailsDoAluno(aluno){ return [aluno?.emailResponsavel1, aluno?.emailResponsavel2, aluno?.emailResponsavel3].filter(Boolean).map(e=>e.trim()).filter(e=>e.includes('@')); }

async function initSeeds(){
  const [campos] = await Promise.all([fetch('data/campos-registro.json').then(r=>r.json())]);
  state.campos = campos;
  $('#dataRegistro').value = today();
  renderCampos();
}
function renderCampos(){
  const box = $('#formCampos'); box.innerHTML='';
  state.campos.filter(c=>!camposAuto.includes(c)).forEach(c=>{
    const wrap=document.createElement('div');
    if(camposLongos.includes(c)) wrap.style.gridColumn='1/-1';
    const label=document.createElement('label'); label.textContent=c;
    const field = camposLongos.includes(c) ? document.createElement('textarea') : document.createElement('input');
    field.name=c; field.placeholder=c;
    if(c.includes('DATA E HORA')) field.type='datetime-local';
    wrap.append(label,field); box.appendChild(wrap);
  });
}
function turmas(){ return [...new Set(state.alunos.map(a=>a.turma).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')); }
function preencherTurmas(){ ['#turmaSelect','#filtroTurma'].forEach(sel=>{ const old=$(sel).value; $(sel).innerHTML = sel==='#filtroTurma'?'<option value="">Todas</option>':'<option value="">Selecione</option>'; turmas().forEach(t=>$(sel).insertAdjacentHTML('beforeend',`<option>${t}</option>`)); $(sel).value=old; }); }
function preencherAlunos(){ const turma=$('#turmaSelect').value; const alunos=state.alunos.filter(a=>!turma||a.turma===turma).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')); $('#alunoSelect').innerHTML='<option value="">Selecione</option>'+alunos.map(a=>`<option value="${a.id}">${a.nome}</option>`).join(''); $('#responsaveisBox').textContent='Selecione o aluno para visualizar os e-mails dos responsáveis.'; }
function alunoSelecionado(){ return state.alunos.find(a=>a.id===$('#alunoSelect').value); }
function atualizarResponsaveis(){ const a=alunoSelecionado(); if(!a) return; const emails=emailsDoAluno(a); $('#responsaveisBox').innerHTML = `<strong>${a.nome}</strong> — ${a.turma}<br>E-mails responsáveis: ${emails.length?emails.join(', '):'<span style="color:#b91c1c">não cadastrados</span>'}`; }
async function carregarAlunos(){ const snap=await getDocs(query(collection(db,colecoes.alunos), orderBy('turma'))); state.alunos=snap.docs.map(d=>({id:d.id,...d.data()})); preencherTurmas(); preencherAlunos(); renderAlunos(); $('#statAlunos').textContent=state.alunos.length; }
async function carregarConfig(){ const ref=doc(db,colecoes.config,'geral'); const s=await getDoc(ref); state.config=s.exists()?s.data():{}; $('#configCopia').value=state.config.emailCopia||''; $('#configUnidade').value=state.config.unidade||''; }
async function salvarConfig(){ await setDoc(doc(db,colecoes.config,'geral'),{emailCopia:$('#configCopia').value.trim(),unidade:$('#configUnidade').value.trim(),updatedAt:serverTimestamp()},{merge:true}); toast('Configurações salvas.'); carregarConfig(); }
async function carregarPerfil(){
  const ref=doc(db,colecoes.usuarios,state.user.uid);
  const s=await getDoc(ref);
  if(s.exists()) {
    state.profile=s.data();
  } else {
    state.profile={nome:state.user.email, email:state.user.email, role:'disciplinario', ativo:true};
    await setDoc(ref,{...state.profile,createdAt:serverTimestamp()},{merge:true});
  }
  if(state.profile.ativo===false){ toast('Usuário desativado. Procure o administrador.','error'); await signOut(auth); return; }
  $('#userLabel').textContent=`${state.user.email} • ${state.profile.role}`;
  $$('.admin-only').forEach(e=>e.style.display=state.profile.role==='admin'?'block':'none');
}

async function salvarRegistro(ev){ ev.preventDefault(); const aluno=alunoSelecionado(); if(!aluno){ toast('Selecione um aluno.','error'); return; }
  const dados={}; new FormData($('#registroForm')).forEach((v,k)=>dados[k]=v);
  const emails=emailsDoAluno(aluno);
  const registro={...dados,TURMA:aluno.turma,ALUNO:aluno.nome,DATA:$('#dataRegistro').value,Email:state.user.email,disciplinario:state.user.email,alunoId:aluno.id,emailsResponsaveis:emails,emailCopia:state.config.emailCopia||'',statusEmail:emails.length?'pendente':'sem-email',createdAt:serverTimestamp(),createdAtLocal:new Date().toISOString()};
  const ref=await addDoc(collection(db,colecoes.ocorrencias),registro);
  await tentarEmailJs(registro,ref.id);
  toast(emails.length?'Registro salvo. E-mail será enviado aos responsáveis.':'Registro salvo, mas o aluno não tem e-mail de responsável cadastrado.');
  $('#registroForm').reset(); atualizarHistorico();
}
async function tentarEmailJs(registro,id){
  if(!emailJsConfig.enabled || !window.emailjs || !registro.emailsResponsaveis?.length) return;
  try{ emailjs.init({publicKey: emailJsConfig.publicKey}); await emailjs.send(emailJsConfig.serviceId,emailJsConfig.templateId,{to_email:registro.emailsResponsaveis.join(','),cc_email:registro.emailCopia||'',aluno:registro.ALUNO,turma:registro.TURMA,data:registro.DATA,ocorrencia:registro['DESCREVA O OCORRIDO']||registro['DESCREVA O OCORRIDO 2']||'',providencia:registro['PROVIDÊNCIA']||'',disciplinario:registro.disciplinario}); await setDoc(doc(db,colecoes.ocorrencias,id),{statusEmail:'enviado-emailjs',emailSentAt:serverTimestamp()},{merge:true}); }catch(e){ console.error(e); await setDoc(doc(db,colecoes.ocorrencias,id),{statusEmail:'erro-emailjs',emailErro:String(e?.text||e?.message||e)},{merge:true}); }
}
async function atualizarHistorico(){ const snap=await getDocs(query(collection(db,colecoes.ocorrencias), orderBy('createdAtLocal','desc'), limit(300))); state.historico=snap.docs.map(d=>({id:d.id,...d.data()})); renderHistorico(); $('#statRegistros').textContent=state.historico.length; $('#statEmails').textContent=state.historico.filter(r=>['pendente','enviado-cloud','enviado-emailjs'].includes(r.statusEmail)).length; }
function renderHistorico(){ const busca=$('#filtroBusca').value.toLowerCase(), turma=$('#filtroTurma').value, ini=$('#filtroInicio').value, fim=$('#filtroFim').value; let lista=state.historico.filter(r=>(!turma||r.TURMA===turma)&&(!ini||r.DATA>=ini)&&(!fim||r.DATA<=fim)); if(busca) lista=lista.filter(r=>JSON.stringify(r).toLowerCase().includes(busca)); $('#listaHistorico').innerHTML=lista.map(r=>`<article class="item"><h4>${r.ALUNO||''}</h4><p><strong>Turma:</strong> ${r.TURMA||''} • <strong>Data:</strong> ${r.DATA||''}</p><p>${r['DESCREVA O OCORRIDO']||r['DESCREVA O OCORRIDO 2']||r['MOTIVO']||'Registro sem descrição.'}</p><div class="badges"><span class="badge">${r['CONTROLE DIÁRIO']||'Registro'}</span><span class="badge">E-mail: ${r.statusEmail||'não informado'}</span></div></article>`).join('') || '<div class="card">Nenhum registro encontrado.</div>'; }
function renderAlunos(){ $('#listaAlunos').innerHTML=state.alunos.slice(0,400).map(a=>`<div class="item"><h4>${a.nome}</h4><p>${a.turma||''}</p><p>${emailsDoAluno(a).join(', ')||'Sem e-mail cadastrado'}</p></div>`).join(''); }
async function salvarAluno(){ const nome=$('#alunoNome').value.trim(), turma=$('#alunoTurma').value.trim(); if(!nome||!turma){toast('Informe nome e turma.','error');return;} const id=slug(`${turma}-${nome}`); await setDoc(doc(db,colecoes.alunos,id),{nome,turma,emailResponsavel1:$('#alunoResp1').value.trim(),emailResponsavel2:$('#alunoResp2').value.trim(),telefoneResponsavel:$('#alunoTel').value.trim(),ativo:true,updatedAt:serverTimestamp()},{merge:true}); toast('Aluno salvo.'); ['#alunoNome','#alunoTurma','#alunoResp1','#alunoResp2','#alunoTel'].forEach(s=>$(s).value=''); await carregarAlunos(); }
async function importarJson(path,colecao,mapper){ const data=await fetch(path).then(r=>r.json()); let batch=writeBatch(db), count=0, lote=0; for(const item of data){ const mapped=mapper(item); const ref=doc(db,colecao,mapped.id||slug(JSON.stringify(mapped).slice(0,80))); delete mapped.id; batch.set(ref,{...mapped,importadoEm:serverTimestamp()},{merge:true}); count++; lote++; if(lote===450){ await batch.commit(); batch=writeBatch(db); lote=0; toast(`${count} importados...`); } } if(lote) await batch.commit(); toast(`${count} registros importados.`); return count; }
async function importarAlunos(){ await importarJson('data/alunos-seed.json',colecoes.alunos,a=>a); await carregarAlunos(); }
async function importarHistorico(){ await importarJson('data/registros-historicos-seed.json',colecoes.ocorrencias,r=>({...r,id:`hist-${r.ID||crypto.randomUUID()}`,createdAtLocal:r['Hora de início']||new Date().toISOString(),statusEmail:'historico'})); await atualizarHistorico(); }
function exportarCsv(){ const rows=state.historico; if(!rows.length){toast('Nada para exportar.','error');return;} const cols=[...new Set(rows.flatMap(r=>Object.keys(r)))]; const csv=[cols.join(';'),...rows.map(r=>cols.map(c=>`"${String(r[c]??'').replace(/"/g,'""')}"`).join(';'))].join('\n'); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); a.download='registro-diario-ocorrencias.csv'; a.click(); }
function trocarPagina(p){ $$('.nav').forEach(b=>b.classList.toggle('active',b.dataset.page===p)); $$('.page').forEach(s=>s.classList.toggle('active',s.id===`page-${p}`)); $('#pageTitle').textContent={novo:'Novo registro',historico:'Histórico',alunos:'Alunos',admin:'Admin'}[p]||'Registro'; $('.sidebar').classList.remove('open'); if(p==='historico') atualizarHistorico(); if(p==='alunos') renderAlunos(); }


async function existeUsuarioAdmin(){
  const snap = await getDocs(query(collection(db,colecoes.usuarios), where('role','==','admin'), limit(1)));
  return !snap.empty;
}
async function criarContaInicial(ev){
  ev.preventDefault();
  const nome=$('#setupNome').value.trim();
  const email=$('#setupEmail').value.trim();
  const senha=$('#setupPassword').value;
  const perfil=$('#setupPerfil').value;
  if(!nome || !email || senha.length<6){ toast('Informe nome, e-mail e senha com pelo menos 6 caracteres.','error'); return; }
  try{
    const adminExiste = await existeUsuarioAdmin();
    const cred = await createUserWithEmailAndPassword(auth,email,senha);
    const role = adminExiste ? perfil : 'admin';
    await setDoc(doc(db,colecoes.usuarios,cred.user.uid),{nome,email,role,ativo:true,createdAt:serverTimestamp()},{merge:true});
    toast(adminExiste ? 'Usuário criado com sucesso.' : 'Primeiro administrador criado com sucesso.');
  }catch(err){ toast('Erro ao criar usuário: '+(err?.message||err),'error'); }
}
function mostrarAbaLogin(aba){
  $('#loginForm').classList.toggle('hidden',aba!=='login');
  $('#setupForm').classList.toggle('hidden',aba!=='setup');
  $('#tabLogin').classList.toggle('active',aba==='login');
  $('#tabSetup').classList.toggle('active',aba==='setup');
  $('#loginHelp').textContent = aba==='login' ? 'Entre com o e-mail e senha cadastrados no programa.' : 'No primeiro cadastro, o sistema cria automaticamente o usuário administrador.';
}

$('#loginForm').addEventListener('submit',async e=>{ e.preventDefault(); try{ await signInWithEmailAndPassword(auth,$('#loginEmail').value,$('#loginPassword').value); }catch(err){toast('Erro no login: '+err.message,'error')} });
$('#setupForm').addEventListener('submit',criarContaInicial);
$('#tabLogin').onclick=()=>mostrarAbaLogin('login');
$('#tabSetup').onclick=()=>mostrarAbaLogin('setup');
$('#logoutBtn').onclick=()=>signOut(auth); $('#menuBtn').onclick=()=>$('.sidebar').classList.toggle('open'); $$('.nav').forEach(b=>b.onclick=()=>trocarPagina(b.dataset.page));
$('#turmaSelect').onchange=preencherAlunos; $('#alunoSelect').onchange=atualizarResponsaveis; $('#registroForm').onsubmit=salvarRegistro; $('#limparForm').onclick=()=>$('#registroForm').reset(); $('#aplicarFiltros').onclick=renderHistorico; $('#exportarCsv').onclick=exportarCsv; $('#salvarAluno').onclick=salvarAluno; $('#importarAlunos').onclick=importarAlunos; $('#importarHistorico').onclick=importarHistorico; $('#salvarConfig').onclick=salvarConfig;
onAuthStateChanged(auth,async user=>{ state.user=user; $('#loginScreen').classList.toggle('hidden',!!user); $('#app').classList.toggle('hidden',!user); if(user){ await initSeeds(); await carregarPerfil(); await carregarConfig(); await carregarAlunos(); await atualizarHistorico(); } });
