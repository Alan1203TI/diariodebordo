import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import nodemailer from 'nodemailer';

initializeApp();
const db = getFirestore();
const SMTP_USER = defineSecret('SMTP_USER');
const SMTP_PASS = defineSecret('SMTP_PASS');
const SMTP_HOST = defineSecret('SMTP_HOST');
const SMTP_PORT = defineSecret('SMTP_PORT');

function htmlEmail(r) {
  const ocorrido = r['DESCREVA O OCORRIDO'] || r['DESCREVA O OCORRIDO 2'] || r.MOTIVO || 'Registro diário realizado.';
  const providencia = r['PROVIDÊNCIA'] || r['CONTATO COM RESPONSÁVEIS'] || '';
  return `
  <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937">
    <h2 style="color:#174ea6">Registro Diário de Aluno</h2>
    <p>Prezados responsáveis,</p>
    <p>Informamos que foi realizado um registro diário referente ao estudante abaixo:</p>
    <table style="border-collapse:collapse;width:100%;max-width:680px">
      <tr><td style="padding:8px;border:1px solid #ddd"><b>Aluno</b></td><td style="padding:8px;border:1px solid #ddd">${r.ALUNO || ''}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd"><b>Turma</b></td><td style="padding:8px;border:1px solid #ddd">${r.TURMA || ''}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd"><b>Data</b></td><td style="padding:8px;border:1px solid #ddd">${r.DATA || ''}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd"><b>Controle</b></td><td style="padding:8px;border:1px solid #ddd">${r['CONTROLE DIÁRIO'] || ''}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd"><b>Ocorrido</b></td><td style="padding:8px;border:1px solid #ddd">${ocorrido}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ddd"><b>Providência</b></td><td style="padding:8px;border:1px solid #ddd">${providencia}</td></tr>
    </table>
    <p>Atenciosamente,<br>${r.disciplinario || 'Equipe escolar'}</p>
  </div>`;
}

export const enviarEmailOcorrencia = onDocumentCreated({
  document: 'ocorrencias/{ocorrenciaId}',
  region: 'southamerica-east1',
  secrets: [SMTP_USER, SMTP_PASS, SMTP_HOST, SMTP_PORT]
}, async (event) => {
  const ref = event.data.ref;
  const r = event.data.data();
  if (!r || r.statusEmail === 'historico') return;
  const to = Array.isArray(r.emailsResponsaveis) ? r.emailsResponsaveis.filter(e => String(e).includes('@')) : [];
  if (!to.length) {
    await ref.set({ statusEmail: 'sem-email', emailProcessadoEm: FieldValue.serverTimestamp() }, { merge: true });
    return;
  }
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST.value(),
    port: Number(SMTP_PORT.value() || 587),
    secure: Number(SMTP_PORT.value()) === 465,
    auth: { user: SMTP_USER.value(), pass: SMTP_PASS.value() }
  });
  try {
    await transporter.sendMail({
      from: `Registro Diário <${SMTP_USER.value()}>`,
      to: to.join(','),
      cc: r.emailCopia || undefined,
      subject: `Registro Diário - ${r.ALUNO || 'Aluno'} - ${r.TURMA || ''}`,
      html: htmlEmail(r)
    });
    await ref.set({ statusEmail: 'enviado-cloud', emailEnviadoEm: FieldValue.serverTimestamp() }, { merge: true });
  } catch (err) {
    await ref.set({ statusEmail: 'erro-cloud', emailErro: String(err?.message || err), emailProcessadoEm: FieldValue.serverTimestamp() }, { merge: true });
  }
});
