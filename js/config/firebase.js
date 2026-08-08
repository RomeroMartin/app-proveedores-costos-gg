// ============================================================
// config/firebase.js — Conexión con Firebase
// ------------------------------------------------------------
// ⚠️  IMPORTANTE: esta app usa su PROPIO proyecto Firebase, distinto
// del de "Green Garden Inventario". Sus firestore.rules y colecciones
// (proveedores, insumos, facturas, pagos, recetas) no deben mezclarse
// con las del inventario.
//
// TODO (una sola vez, antes de desplegar):
//   1. En la consola de Firebase, crear un proyecto nuevo
//      (ej. "green-garden-costos") y una Web App.
//   2. Habilitar Authentication (Email/Password), Firestore y Hosting.
//   3. Pegar acá el firebaseConfig que te da la consola.
// La apiKey de una Web App NO es un secreto (queda visible en el cliente);
// la seguridad real la dan las firestore.rules.
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyC8jCBEPsIGcrEaONqdJboMcJOWfJDH5ok",
  authDomain: "green-garden-costos.firebaseapp.com",
  projectId: "green-garden-costos",
  storageBucket: "green-garden-costos.firebasestorage.app",
  messagingSenderId: "1029936465560",
  appId: "1:1029936465560:web:6acb9f31e7bf6bc4bcf2ed",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
