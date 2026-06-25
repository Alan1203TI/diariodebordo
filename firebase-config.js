// Configuração Firebase já preenchida para o projeto: diariodebordo-618c6
// Authentication: ative Email/Senha no Firebase
// Firestore: publique as regras do arquivo firestore.rules

export const firebaseConfig = {
  apiKey: "AIzaSyBTm3fU3RcMTkG9Z9SHNNHY3iB7M7fDUlg",
  authDomain: "diariodebordo-618c6.firebaseapp.com",
  projectId: "diariodebordo-618c6",
  storageBucket: "diariodebordo-618c6.firebasestorage.app",
  messagingSenderId: "326158801251",
  appId: "1:326158801251:web:95cbba2c788e47ceac5b56"
};

// Configuração opcional para envio direto via EmailJS.
// Deixe enabled:false se for usar apenas Cloud Functions ou se ainda não configurou o EmailJS.
export const emailJsConfig = {
  enabled: true,
  publicKey: "xVJofhQxZtgMgXSHE",
  serviceId: "service_hxs1dnc",
  templateId: "template_gp9jyis"
};

window.emailJsConfig = emailJsConfig;
