# Contexto — Gestión de usuarios y seguridad (Costos y Proveedores, v0.3.0)

> Documento para **no olvidar** cómo funciona la creación de usuarios y las
> reglas de seguridad de la app **Green Garden — Costos y Proveedores**
> (proyecto Firebase `green-garden-costos`, repo `app-proveedores-costos-gg`).

> ⚠️ **OJO — dos apps distintas.** Esta app NO es la de inventario. Son dos
> proyectos Firebase separados y dos repos separados:
>
> | | App | Repo | Proyecto Firebase |
> |---|---|---|---|
> | **Costos** (esta) | Costos y Proveedores | `app-proveedores-costos-gg` | `green-garden-costos` |
> | Inventario | Control de Stock | `appgreengarden` | `control-stoks---green-garden` |
>
> Cuando hagas `firebase deploy`, fijate que diga
> `=== Deploying to 'green-garden-costos'...`. Si dice otro proyecto, estás
> en la carpeta equivocada.

---

## 1. Qué se pidió

1. **Crear usuarios desde la app**, sin ir a Firebase a copiar el UID a mano.
2. **Reglas de seguridad** para que **nadie** pueda crearse usuarios ni
   ascenderse a Gerente por la consola del navegador.

## 2. Cómo estaba antes (los dos problemas)

- **Se copiaba el UID a mano.** La pantalla de Usuarios te hacía ir a
  *Firebase → Authentication → Users*, crear la cuenta, **copiar el UID** y
  pegarlo en un campo. Engorroso y con error humano.
- **Agujero de seguridad real en las reglas:**
  ```
  match /usuarios/{uid} {
    allow read: if autenticado();
    allow write: if autenticado() && (request.auth.uid == uid || esGerente());
  }
  ```
  El `request.auth.uid == uid` dejaba que **cualquier** usuario logueado
  escribiera su propio perfil… incluido ponerse `rol: 'Gerente'` desde la
  consola del navegador. Auto-ascenso.

## 3. Cómo quedó (v0.3.0)

### a) Alta de usuarios desde la app — "segunda instancia"

Firebase tiene una limitación: si creás la cuenta con el SDK normal, te
**desloguea** y te convierte en el usuario nuevo. La solución (100 % en el
navegador, **sin plan pago ni Cloud Functions**) es una **segunda instancia**
de Firebase que crea la cuenta en paralelo:

```
// js/ui/usuarios.js
const appSec  = initializeApp(firebaseConfig, "secondary-usuarios");
const authSec = getAuth(appSec);

const cred = await createUserWithEmailAndPassword(authSec, email, password);
await usuariosRepo.guardar(cred.user.uid, { nombre, email, rol, activo }); // UID automático
await signOutSec(authSec);   // cierra SOLO la sesión secundaria
```

- Tu sesión de Gerente (instancia principal) **queda intacta**.
- El **UID sale de `cred.user.uid`** → **nunca** se copia a mano.
- En la pantalla de Usuarios ahora cargás **nombre + email + contraseña
  temporal + rol** y listo.

### b) Bootstrap del dueño SIN consola

- **Email del dueño:** `martingreengaren@gmail.com`
- Ese email —y **solo** ese— puede crearse/restaurarse como `Gerente` activo.
- Al iniciar sesión el dueño sin perfil, `js/auth.js` se lo crea solo. Las
  **reglas** son las que autorizan eso, únicamente para su email.

### c) Reglas de `usuarios` (lo importante)

```
match /usuarios/{uid} {
  allow read:   if autenticado();               // la app necesita el rol al entrar
  allow create: if esGerente() || bootstrapDueno(uid);
  allow update: if esGerente() || bootstrapDueno(uid);
  allow delete: if false;                        // baja lógica con activo=false
}
```

- **Nadie** puede escribir su propio perfil (se quitó `request.auth.uid == uid`).
  → no hay auto-ascenso a Gerente por consola.
- Único caso especial: el **dueño** fijando/restaurando **su propio** perfil
  como Gerente activo (`bootstrapDueno`).

### d) Mínimo privilegio en la UI

`js/auth.js` → si una cuenta no tiene perfil, se la trata como **Cargador**
(antes era Gerente por defecto). El dueño es la excepción (Gerente), y se
autoconfigura al entrar. Igual, la barrera real son las reglas.

## 4. ⚠️ Si cambiás el email del dueño

Hay que tocarlo en **DOS** lugares (si quedan distintos, el bootstrap deja de
andar):

1. `firestore.rules` → función `esDueno()`
2. `js/config/firebase.js` → constante `EMAIL_DUENO`

## 5. Roles

Solo dos: `Gerente` (acceso total, gestiona usuarios) y `Cargador` (carga
operativa). Definidos en `js/roles.js`.

## 6. Cómo crear un usuario (flujo actual)

1. Entrar como **Gerente** → **Usuarios** → **Nuevo usuario**.
2. Cargar **nombre + email + contraseña temporal + rol** (un solo paso).
3. Guardar. La cuenta se crea desde la app sin desloguearte.
4. Pasale a la persona su email + contraseña temporal.

## 7. Deploy

```bash
firebase deploy --only hosting,firestore:rules
```
- Verificá que diga `=== Deploying to 'green-garden-costos'...`.
- Solo app:     `firebase deploy --only hosting`
- Solo reglas:  `firebase deploy --only firestore:rules`

## 8. Archivos tocados en v0.3.0

- `firestore.rules` — cierra auto-ascenso + ancla del dueño (bootstrap).
- `js/ui/usuarios.js` — alta desde la app con 2da instancia (sin copiar UID).
- `js/auth.js` — bootstrap del dueño al loguear + default Cargador sin perfil.
- `js/config/firebase.js` — constante `EMAIL_DUENO`.
- `js/version.js` — v0.2.0 → v0.3.0.

## 9. Ideas para más adelante (no hechas)

- Botón "cambiar mi contraseña" dentro de la app.
- Mail de "restablecer contraseña" al crear el usuario (`sendPasswordResetEmail`).
- Blindaje fuerte de roles con **custom claims / Cloud Functions** (requiere
  plan Blaze). Hoy la seguridad la dan las reglas + el ancla del dueño.
