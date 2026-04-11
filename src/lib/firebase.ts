import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, onSnapshot, addDoc, orderBy, getDocFromServer, FirestoreError } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import localConfig from '../../firebase-applet-config.json';

// Use local config as base, override with env if available and non-empty
const firebaseConfig = {
  ...localConfig,
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_API_KEY.length > 0) 
    ? import.meta.env.VITE_FIREBASE_API_KEY 
    : localConfig.apiKey,
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN && import.meta.env.VITE_FIREBASE_AUTH_DOMAIN.length > 0)
    ? import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
    : localConfig.authDomain,
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID && import.meta.env.VITE_FIREBASE_PROJECT_ID.length > 0)
    ? import.meta.env.VITE_FIREBASE_PROJECT_ID
    : localConfig.projectId,
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET && import.meta.env.VITE_FIREBASE_STORAGE_BUCKET.length > 0)
    ? import.meta.env.VITE_FIREBASE_STORAGE_BUCKET
    : localConfig.storageBucket,
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID && import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID.length > 0)
    ? import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID
    : localConfig.messagingSenderId,
  appId: (import.meta.env.VITE_FIREBASE_APP_ID && import.meta.env.VITE_FIREBASE_APP_ID.length > 0)
    ? import.meta.env.VITE_FIREBASE_APP_ID
    : localConfig.appId,
};

const firestoreDatabaseId = (import.meta.env.VITE_FIREBASE_DATABASE_ID && import.meta.env.VITE_FIREBASE_DATABASE_ID.length > 0)
  ? import.meta.env.VITE_FIREBASE_DATABASE_ID
  : (localConfig as any).firestoreDatabaseId;

export { firestoreDatabaseId };

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app, firebaseConfig.storageBucket);
export const googleProvider = new GoogleAuthProvider();

// Debug info for production environments
if (typeof window !== 'undefined') {
  console.log('Firebase Initialized with Project ID:', firebaseConfig.projectId);
  console.log('Using Firestore Database ID:', firestoreDatabaseId);
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function seedInitialData() {
  const modules = [
    {
      id: "1",
      order: 1,
      title: "Introducción a la IA Generativa",
      description: "Conceptos básicos de LLMs, redes neuronales y el ecosistema actual de la IA.",
      visible: true,
      materials: [
        { type: 'pdf', title: 'Guía de Conceptos Básicos', url: '#' },
        { type: 'video', title: 'Video Clase 1: Historia de la IA', url: '#' }
      ],
      extra: [
        { type: 'link', title: 'Documentación OpenAI', url: 'https://openai.com' }
      ],
      task: {
        id: "task-1",
        title: "Ensayo sobre el impacto de la IA",
        description: "Escribe un breve ensayo sobre cómo la IA está transformando tu industria.",
        deadline: "2024-05-20T23:59:59Z"
      }
    },
    {
      id: "2",
      order: 2,
      title: "Prompt Engineering Avanzado",
      description: "Técnicas de Few-shot, Chain of Thought y optimización de prompts para mejores resultados.",
      visible: true,
      materials: [
        { type: 'pdf', title: 'Cheat Sheet de Prompts', url: '#' }
      ],
      extra: [],
      task: null
    },
    {
      id: "3",
      order: 3,
      title: "Agentes Autónomos y Herramientas",
      description: "Creación de agentes que pueden ejecutar acciones y usar herramientas externas.",
      visible: false,
      materials: [],
      extra: [],
      task: null
    }
  ];

  for (const mod of modules) {
    await setDoc(doc(db, 'modules', mod.id), mod);
  }
}

// Test connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof FirestoreError && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();
