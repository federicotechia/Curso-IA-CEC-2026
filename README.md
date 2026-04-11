# Curso IA 2026 - CEC

Plataforma educativa para la gestión de clases, tareas y consultas sobre Inteligencia Artificial.

## 🚀 Despliegue en Vercel

Para desplegar esta aplicación en Vercel, sigue estos pasos:

### 1. Configurar Variables de Entorno
En el panel de control de tu proyecto en Vercel, añade las siguientes variables de entorno (puedes encontrarlas en tu consola de Firebase):

- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_DATABASE_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`

### 2. Autorizar Dominio en Firebase
Para que la autenticación de Google funcione, debes añadir el dominio de tu app de Vercel en la consola de Firebase:
1. Ve a **Authentication** > **Settings** > **Authorized Domains**.
2. Añade tu dominio de Vercel (ej: `mi-curso-ia.vercel.app`).

## 🛠️ Desarrollo Local

1. Instala las dependencias:
   ```bash
   npm install
   ```

2. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

## 📦 Estructura del Proyecto

- `src/`: Código fuente de la aplicación React.
- `server.ts`: Servidor Express para manejar la app en producción.
- `firestore.rules`: Reglas de seguridad para la base de datos.
- `firebase-blueprint.json`: Estructura de datos de la aplicación.
