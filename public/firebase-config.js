// 1) Crie um projeto no Firebase
// 2) Ative Authentication > Email/senha
// 3) Ative Firestore Database
// 4) Cole aqui as configurações do app Web do Firebase
export const firebaseConfig = {
  apiKey: "COLE_SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000000000"
};

// Opcional: envio direto via EmailJS sem PHP/Node. Use apenas se não for usar Cloud Functions.
// Crie conta em https://www.emailjs.com/ e preencha os dados abaixo.
export const emailJsConfig = {
  enabled: false,
  publicKey: "",
  serviceId: "",
  templateId: ""
};
