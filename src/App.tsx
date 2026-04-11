import React, { useState, useEffect, ReactNode } from 'react';
import { 
  BookOpen, 
  Users, 
  MessageSquare, 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Download, 
  CheckCircle, 
  Clock, 
  Video, 
  Link as LinkIcon, 
  File as FileIcon,
  Eye,
  EyeOff,
  Book,
  LogOut,
  Send,
  UserPlus,
  ShieldCheck,
  Loader2,
  AlertCircle,
  Edit,
  X,
  Trash2,
  Upload,
  FileUp,
  ExternalLink,
  CornerDownRight,
  ArrowUp,
  ArrowDown,
  Search,
  Filter,
  History,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { ClassModule, ForumPost, Submission, UserProfile, UserRole, Task } from './types';
import { auth, db, storage, googleProvider, handleFirestoreError, OperationType, firestoreDatabaseId } from './lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  getDoc, 
  updateDoc, 
  addDoc, 
  deleteDoc,
  query, 
  orderBy, 
  where
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function AppContent() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<ClassModule[]>([]);
  const [forum, setForum] = useState<ForumPost[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [newPost, setNewPost] = useState('');
  const [submissionUrl, setSubmissionUrl] = useState<{ [key: string]: string }>({});
  const [activeTab, setActiveTab] = useState<'clases' | 'foro' | 'tareas' | 'admin'>('clases');
  const [showNewModuleModal, setShowNewModuleModal] = useState(false);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [newModuleDescription, setNewModuleDescription] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskDeadline, setNewTaskDeadline] = useState('');
  const [newTaskAttachmentUrl, setNewTaskAttachmentUrl] = useState('');
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editModuleData, setEditModuleData] = useState<any>(null);
  const [editTaskData, setEditTaskData] = useState<any>(null);
  const [uploading, setUploading] = useState<string | null>(null); // moduleId-type-index or 'submission-taskId'
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ show: false, title: '', message: '', onConfirm: () => {} });

  const [taskSearch, setTaskSearch] = useState('');
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'completed'>('all');

  // Clear notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        try {
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const data = userDoc.data() as UserProfile;
            // Force admin status for the owner even if already exists
            if (firebaseUser.email === 'federicotechia@gmail.com' && (data.role !== 'administrador' || data.status !== 'approved')) {
              const updatedProfile = { ...data, role: 'administrador' as const, status: 'approved' as const };
              await setDoc(userDocRef, updatedProfile, { merge: true });
              setProfile(updatedProfile);
            } else {
              setProfile(data);
            }
          } else {
            // Pre-registration logic
            const isAdminEmail = ["federicotechia@gmail.com", "fede.trillini@gmail.com"].includes(firebaseUser.email || '');
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'Usuario',
              role: isAdminEmail ? 'administrador' : 'alumno',
              status: isAdminEmail ? 'approved' : 'pending'
            };
            await setDoc(userDocRef, newProfile);
            setProfile(newProfile);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Data Listeners
  useEffect(() => {
    if (!profile || profile.status !== 'approved') return;

    // Modules
    const modulesQuery = (profile.role === 'profesor' || profile.role === 'administrador')
      ? query(collection(db, 'modules'))
      : query(collection(db, 'modules'), where('visible', '==', true));
    
    const unsubscribeModules = onSnapshot(modulesQuery, (snapshot) => {
      const fetchedModules = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ClassModule));
      // Sort in memory to handle modules without 'order' field or with NaN
      fetchedModules.sort((a, b) => {
        const orderA = typeof a.order === 'number' && !isNaN(a.order) ? a.order : 0;
        const orderB = typeof b.order === 'number' && !isNaN(b.order) ? b.order : 0;
        if (orderA !== orderB) return orderA - orderB;
        return a.id.localeCompare(b.id);
      });
      setModules(fetchedModules);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'modules'));

    // Forum
    const forumQuery = query(collection(db, 'forum'), orderBy('date', 'desc'));
    const unsubscribeForum = onSnapshot(forumQuery, (snapshot) => {
      setForum(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ForumPost)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'forum'));

    // Tasks
    const tasksQuery = query(collection(db, 'tasks'), orderBy('order', 'asc'));
    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      const fetchedTasks = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Task));
      fetchedTasks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setTasks(fetchedTasks);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'tasks'));

    // Submissions
    if (profile.role === 'profesor' || profile.role === 'administrador') {
      const subQuery = query(collection(db, 'submissions'), orderBy('date', 'desc'));
      const unsubscribeSub = onSnapshot(subQuery, (snapshot) => {
        setSubmissions(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Submission)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'submissions'));

      // Pending Users for Admin
      const pendingQuery = query(collection(db, 'users'), where('status', '==', 'pending'));
      const unsubscribePending = onSnapshot(pendingQuery, (snapshot) => {
        setPendingUsers(snapshot.docs.map(doc => doc.data() as UserProfile));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

      // All Users for Admin Role Management
      const allUsersQuery = query(collection(db, 'users'), orderBy('displayName', 'asc'));
      const unsubscribeAllUsers = onSnapshot(allUsersQuery, (snapshot) => {
        setAllUsers(snapshot.docs.map(doc => doc.data() as UserProfile));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

      return () => {
        unsubscribeModules();
        unsubscribeForum();
        unsubscribeTasks();
        unsubscribeSub();
        unsubscribePending();
        unsubscribeAllUsers();
      };
    } else {
      const subQuery = query(collection(db, 'submissions'), where('studentUid', '==', profile.uid));
      const unsubscribeSub = onSnapshot(subQuery, (snapshot) => {
        setSubmissions(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Submission)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'submissions'));

      return () => {
        unsubscribeModules();
        unsubscribeForum();
        unsubscribeTasks();
        unsubscribeSub();
      };
    }
  }, [profile]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim() || !profile) return;
    try {
      const newTaskId = Date.now().toString();
      const newTask: Task = {
        id: newTaskId,
        order: tasks.length > 0 ? Math.max(...tasks.map(t => t.order ?? 0)) + 1 : 1,
        title: newTaskTitle,
        description: newTaskDescription,
        deadline: newTaskDeadline || new Date().toISOString(),
        attachmentUrl: newTaskAttachmentUrl
      };
      await setDoc(doc(db, 'tasks', newTaskId), newTask);
      const formattedDate = new Date(newTask.deadline).toLocaleDateString(undefined, { timeZone: 'UTC' });
      setShowNewTaskModal(false);
      setNewTaskTitle('');
      setNewTaskDescription('');
      setNewTaskDeadline('');
      setNewTaskAttachmentUrl('');
      setNotification({ 
        message: `Tarea "${newTask.title}" creada con éxito. Límite: ${formattedDate}`, 
        type: 'success' 
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tasks');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setConfirmModal({
      show: true,
      title: "Eliminar Tarea",
      message: "¿Estás seguro de que deseas eliminar esta tarea?",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'tasks', taskId));
          setNotification({ message: "Tarea eliminada", type: 'success' });
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `tasks/${taskId}`);
        }
        setConfirmModal(prev => ({ ...prev, show: false }));
      }
    });
  };

  const handleUpdateTask = async () => {
    if (!editingTask || !editTaskData) return;
    try {
      await updateDoc(doc(db, 'tasks', editingTask), editTaskData);
      const formattedDate = new Date(editTaskData.deadline).toLocaleDateString(undefined, { timeZone: 'UTC' });
      setEditingTask(null);
      setEditTaskData(null);
      setNotification({ 
        message: `Tarea "${editTaskData.title}" actualizada con éxito. Nuevo límite: ${formattedDate}`, 
        type: 'success' 
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${editingTask}`);
    }
  };

  const handleMoveTask = async (taskId: string, direction: 'up' | 'down') => {
    const currentIndex = tasks.findIndex(t => t.id === taskId);
    if (currentIndex === -1) return;
    
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= tasks.length) return;

    const currentTask = tasks[currentIndex];
    const targetTask = tasks[targetIndex];

    const currentOrder = currentTask.order ?? (currentIndex + 1);
    const targetOrder = targetTask.order ?? (targetIndex + 1);

    try {
      await updateDoc(doc(db, 'tasks', currentTask.id), { order: targetOrder });
      await updateDoc(doc(db, 'tasks', targetTask.id), { order: currentOrder });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };
  const handleCreateModule = async () => {
    if (!newModuleTitle.trim() || !profile) return;
    try {
      const newModuleId = Date.now().toString();
      const newModule: ClassModule = {
        id: newModuleId,
        order: modules.length > 0 ? Math.max(...modules.map(m => typeof m.order === 'number' ? m.order : 0)) + 1 : 1,
        title: newModuleTitle,
        description: newModuleDescription,
        materials: [],
        extra: [],
        task: null,
        visible: true
      };
      await setDoc(doc(db, 'modules', newModuleId), newModule);
      setShowNewModuleModal(false);
      setNewModuleTitle('');
      setNewModuleDescription('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'modules');
    }
  };

  const handlePostForum = async () => {
    if (!newPost.trim() || !profile) return;
    try {
      await addDoc(collection(db, 'forum'), {
        user: profile.displayName,
        text: newPost,
        date: new Date().toISOString(),
        uid: profile.uid,
        replies: []
      });
      setNewPost('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'forum');
    }
  };

  const handleReplyForum = async (postId: string) => {
    if (!replyText.trim() || !profile) return;
    try {
      const postRef = doc(db, 'forum', postId);
      const postSnap = await getDoc(postRef);
      if (postSnap.exists()) {
        const postData = postSnap.data() as ForumPost;
        const newReply = {
          id: Date.now().toString(),
          user: profile.displayName,
          text: replyText,
          date: new Date().toISOString(),
          uid: profile.uid
        };
        await updateDoc(postRef, {
          replies: [...(postData.replies || []), newReply]
        });
        setReplyText('');
        setReplyingTo(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `forum/${postId}`);
    }
  };

  const handleDeleteForumPost = async (postId: string) => {
    if (!profile || (profile.role !== 'profesor' && profile.role !== 'administrador')) return;
    setConfirmModal({
      show: true,
      title: "Eliminar Consulta",
      message: "¿Estás seguro de que quieres eliminar esta consulta?",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'forum', postId));
          setNotification({ message: "Consulta eliminada", type: 'success' });
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `forum/${postId}`);
        }
        setConfirmModal(prev => ({ ...prev, show: false }));
      }
    });
  };

  const handleDeleteForumReply = async (postId: string, replyId: string) => {
    if (!profile || (profile.role !== 'profesor' && profile.role !== 'administrador')) return;
    setConfirmModal({
      show: true,
      title: "Eliminar Respuesta",
      message: "¿Estás seguro de que quieres eliminar esta respuesta?",
      onConfirm: async () => {
        try {
          const postRef = doc(db, 'forum', postId);
          const postSnap = await getDoc(postRef);
          if (postSnap.exists()) {
            const postData = postSnap.data() as ForumPost;
            const updatedReplies = (postData.replies || []).filter(r => r.id !== replyId);
            await updateDoc(postRef, { replies: updatedReplies });
            setNotification({ message: "Respuesta eliminada", type: 'success' });
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `forum/${postId}`);
        }
        setConfirmModal(prev => ({ ...prev, show: false }));
      }
    });
  };

  const handleLinkSubmission = async (taskId: string, taskTitle: string) => {
    if (!profile || !submissionUrl[taskId]?.trim()) return;
    
    if (!taskId) {
      setNotification({ message: "Error: Esta tarea no tiene un identificador válido. Por favor, contacta al profesor.", type: 'error' });
      return;
    }
    const url = submissionUrl[taskId].trim();
    if (!url.startsWith('http')) {
      setNotification({ message: "Por favor, ingresa una URL válida (ej: https://drive.google.com/...)", type: 'error' });
      return;
    }

    setUploading(`submission-${taskId}`);
    
    try {
      await addDoc(collection(db, 'submissions'), {
        studentName: profile.displayName,
        studentUid: profile.uid,
        taskId,
        taskTitle,
        fileName: "Enlace Externo",
        fileUrl: url,
        date: new Date().toISOString(),
        status: 'Recibido'
      });
      setNotification({ message: "¡Enlace de tarea entregado con éxito!", type: 'success' });
      setSubmissionUrl(prev => ({ ...prev, [taskId]: '' }));
    } catch (error: any) {
      console.error("Submission error:", error);
      setNotification({ message: "Error al entregar la tarea.", type: 'error' });
      handleFirestoreError(error, OperationType.CREATE, 'submissions');
    } finally {
      setUploading(null);
    }
  };

  const handleToggleVisibility = async (id: string, current: boolean) => {
    try {
      await updateDoc(doc(db, 'modules', id), { visible: !current });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `modules/${id}`);
    }
  };

  const handleUpdateNotebookUrl = async (id: string, url: string) => {
    try {
      await updateDoc(doc(db, 'modules', id), { notebookLMUrl: url });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `modules/${id}`);
    }
  };

  const handleMoveModule = async (moduleId: string, direction: 'up' | 'down') => {
    const currentIndex = modules.findIndex(m => m.id === moduleId);
    if (currentIndex === -1) return;
    
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= modules.length) return;

    const currentModule = modules[currentIndex];
    const targetModule = modules[targetIndex];

    // Ensure we have valid numbers for order
    const currentOrder = typeof currentModule.order === 'number' && !isNaN(currentModule.order) 
      ? currentModule.order 
      : (currentIndex + 1);
    const targetOrder = typeof targetModule.order === 'number' && !isNaN(targetModule.order) 
      ? targetModule.order 
      : (targetIndex + 1);

    // If orders are the same, we must force a difference to allow swapping
    let finalTargetOrder = targetOrder;
    let finalCurrentOrder = currentOrder;

    if (finalTargetOrder === finalCurrentOrder) {
      if (direction === 'up') {
        finalTargetOrder = finalCurrentOrder - 1;
      } else {
        finalTargetOrder = finalCurrentOrder + 1;
      }
    }

    try {
      await updateDoc(doc(db, 'modules', currentModule.id), { order: finalTargetOrder });
      await updateDoc(doc(db, 'modules', targetModule.id), { order: finalCurrentOrder });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `modules/${moduleId}`);
    }
  };

  const handleGradeSubmission = async (submissionId: string) => {
    try {
      await updateDoc(doc(db, 'submissions', submissionId), { status: 'Calificado' });
      setNotification({ message: "Tarea marcada como calificada", type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `submissions/${submissionId}`);
    }
  };

  const handleDeleteSubmission = async (submissionId: string) => {
    setConfirmModal({
      show: true,
      title: "Eliminar Entrega",
      message: "¿Estás seguro de que deseas eliminar esta entrega?",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'submissions', submissionId));
          setNotification({ message: "Entrega eliminada", type: 'success' });
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `submissions/${submissionId}`);
        }
        setConfirmModal(prev => ({ ...prev, show: false }));
      }
    });
  };

  const startEditingModule = (mod: any) => {
    setEditingModule(mod.id);
    setEditModuleData({ ...mod });
  };

  const cancelEditingModule = () => {
    setEditingModule(null);
    setEditModuleData(null);
  };

  const saveModuleChanges = async () => {
    if (!editModuleData || !editingModule) return;
    try {
      const { id, ...dataToUpdate } = editModuleData;
      await updateDoc(doc(db, 'modules', editingModule), dataToUpdate);
      setEditingModule(null);
      setEditModuleData(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `modules/${editingModule}`);
    }
  };

  const addMaterial = (type: 'materials' | 'extra') => {
    if (!editModuleData) return;
    const newItem = type === 'materials' 
      ? { title: 'Nuevo Material', url: '', type: 'pdf' }
      : { title: 'Nuevo Enlace', url: '' };
    
    setEditModuleData({
      ...editModuleData,
      [type]: [...(editModuleData[type] || []), newItem]
    });
  };

  const updateMaterial = (type: 'materials' | 'extra', index: number, field: string, value: any) => {
    if (!editModuleData) return;
    const newList = [...(editModuleData[type] || [])];
    newList[index] = { ...newList[index], [field]: value };
    setEditModuleData({ ...editModuleData, [type]: newList });
  };

  const removeMaterial = (type: 'materials' | 'extra', index: number) => {
    if (!editModuleData) return;
    const newList = [...(editModuleData[type] || [])];
    newList.splice(index, 1);
    setEditModuleData({ ...editModuleData, [type]: newList });
  };

  const updateTask = (field: string, value: any) => {
    if (!editModuleData) return;
    setEditModuleData({
      ...editModuleData,
      task: { ...(editModuleData.task || { id: Date.now().toString(), title: '', description: '', deadline: new Date().toISOString() }), [field]: value }
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'materials' | 'extra', index: number) => {
    const file = e.target.files?.[0];
    if (!file || !editModuleData || !editingModule) return;

    // Size limit: 10MB
    if (file.size > 10 * 1024 * 1024) {
      setNotification({ message: "El archivo es demasiado grande (máximo 10MB)", type: 'error' });
      return;
    }

    const uploadId = `${editingModule}-${type}-${index}`;
    setUploading(uploadId);
    setUploadProgress(prev => ({ ...prev, [uploadId]: 50 }));
    console.log(`Iniciando subida simple: ${file.name}`);

    try {
      const storageRef = ref(storage, `modules/${editingModule}/${type}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      
      updateMaterial(type, index, 'url', url);
      
      if (!editModuleData[type][index].title || editModuleData[type][index].title.startsWith('Nuevo')) {
        updateMaterial(type, index, 'title', file.name);
      }
      
      if (type === 'materials') {
        const isVideo = file.type.startsWith('video/');
        updateMaterial(type, index, 'type', isVideo ? 'video' : 'pdf');
      }
      
      setNotification({ message: "Archivo subido con éxito", type: 'success' });
    } catch (error: any) {
      console.error("Upload error:", error);
      let message = "Error al subir. ";
      if (error.code === 'storage/unauthorized') message += "Revisa las reglas de Storage.";
      else if (error.code === 'storage/project-not-found') message += "Storage no activado.";
      else message += error.message;
      setNotification({ message, type: 'error' });
    } finally {
      setUploading(null);
      setUploadProgress(prev => {
        const next = { ...prev };
        delete next[uploadId];
        return next;
      });
    }
  };

  const handleApproveUser = async (uid: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), { status: 'approved' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleUpdateUserRole = async (uid: string, role: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', uid), { role });
      setNotification({ message: `Rol actualizado a ${role}`, type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-dark">
        <Loader2 className="text-brand-red animate-spin" size={48} />
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-dark p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md border-t-8 border-brand-red"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-brand-red rounded-2xl flex items-center justify-center font-bold text-2xl text-white mx-auto mb-4 shadow-lg shadow-brand-red/20">IA</div>
            <h1 className="text-3xl font-extrabold text-brand-dark tracking-tight">Curso IA 2026</h1>
            <p className="text-slate-500 mt-2 font-medium">CEC - Plataforma Educativa</p>
          </div>
          <div className="space-y-4">
            <button 
              onClick={handleLogin}
              className="w-full p-4 bg-brand-red text-white rounded-xl font-bold hover:bg-brand-red/90 transition-all shadow-lg shadow-brand-red/20 flex items-center justify-center gap-3 active:scale-95"
            >
              <Users size={20} /> Acceder con Google
            </button>
            <p className="text-center text-[10px] text-slate-400 px-4 uppercase tracking-widest font-bold">
              Acceso exclusivo para alumnos y profesores
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (profile.status === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-dark p-4">
        <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md text-center border-t-8 border-amber-500">
          <Clock className="mx-auto text-amber-500 mb-6" size={56} />
          <h2 className="text-2xl font-extrabold text-brand-dark mb-3">Registro Pendiente</h2>
          <p className="text-slate-600 mb-8 leading-relaxed">
            Hola <strong className="text-brand-dark">{profile.displayName}</strong>, tu solicitud ha sido enviada. Un profesor debe aprobar tu acceso antes de que puedas ver el contenido.
          </p>
          <button 
            onClick={handleLogout}
            className="text-slate-400 hover:text-brand-red transition-colors flex items-center gap-2 mx-auto font-bold text-sm uppercase tracking-wider"
          >
            <LogOut size={16} /> Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -50, x: '-50%' }}
            animate={{ opacity: 1, y: 20, x: '-50%' }}
            exit={{ opacity: 0, y: -50, x: '-50%' }}
            className={`fixed top-0 left-1/2 z-[100] px-6 py-3 rounded-full shadow-lg flex items-center gap-3 text-sm font-bold ${
              notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`}
          >
            {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-brand-dark text-white p-6 flex flex-col shadow-2xl z-20">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-brand-red rounded-lg flex items-center justify-center font-bold text-lg shrink-0 shadow-lg shadow-brand-red/20">IA</div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight leading-none">Curso IA 2026</span>
            <span className="text-[10px] font-black text-brand-red tracking-widest">CEC</span>
          </div>
        </div>
        
        <nav className="flex-1 space-y-2">
          <button 
            onClick={() => setActiveTab('clases')}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${activeTab === 'clases' ? 'bg-brand-red text-white shadow-lg shadow-brand-red/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
          >
            <BookOpen size={18} /> Clases
          </button>
          <button 
            onClick={() => setActiveTab('foro')}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${activeTab === 'foro' ? 'bg-brand-red text-white shadow-lg shadow-brand-red/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
          >
            <MessageSquare size={18} /> Foro
          </button>
          <button 
            onClick={() => setActiveTab('tareas')}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${activeTab === 'tareas' ? 'bg-brand-red text-white shadow-lg shadow-brand-red/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
          >
            <FileText size={18} /> Tareas
          </button>
          {(profile.role === 'profesor' || profile.role === 'administrador') && (
            <button 
              onClick={() => setActiveTab('admin')}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${activeTab === 'admin' ? 'bg-brand-red text-white shadow-lg shadow-brand-red/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <ShieldCheck size={18} /> Usuarios
            </button>
          )}
        </nav>

        <div className="mt-auto pt-6 border-t border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs uppercase">
              {profile.displayName[0]}
            </div>
            <div className="text-sm">
              <p className="font-medium capitalize">{profile.displayName}</p>
              <p className="text-slate-500 text-xs">{profile.role}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-2 text-slate-400 hover:text-white transition-colors text-sm"
          >
            <LogOut size={16} /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-10 overflow-y-auto bg-brand-gray/30">
        <header className="mb-8 flex justify-between items-center">
          <h2 className="text-3xl font-extrabold text-brand-dark tracking-tight">
            {activeTab === 'clases' ? 'Módulos del Curso' : activeTab === 'foro' ? 'Foro de Consultas' : activeTab === 'tareas' ? 'Gestión de Tareas' : 'Administración de Usuarios'}
          </h2>
          {(profile.role === 'profesor' || profile.role === 'administrador') && (activeTab === 'clases' || activeTab === 'tareas') && (
            <button 
              onClick={() => activeTab === 'clases' ? setShowNewModuleModal(true) : setShowNewTaskModal(true)}
              className="bg-brand-red text-white px-6 py-2.5 rounded-lg flex items-center gap-2 hover:bg-brand-red/90 transition-all shadow-lg shadow-brand-red/20 text-sm font-bold active:scale-95"
            >
              <Plus size={16} /> {activeTab === 'clases' ? 'Nueva Clase' : 'Nueva Tarea'}
            </button>
          )}
        </header>

        <AnimatePresence>
          {showNewModuleModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
              >
                <h3 className="text-xl font-bold text-slate-800 mb-4">Crear Nueva Clase</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
                    <input 
                      type="text" 
                      value={newModuleTitle}
                      onChange={(e) => setNewModuleTitle(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Ej: Introducción a LLMs"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                    <textarea 
                      value={newModuleDescription}
                      onChange={(e) => setNewModuleDescription(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none h-32 resize-none"
                      placeholder="Describe brevemente el contenido de esta clase..."
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button 
                      onClick={() => setShowNewModuleModal(false)}
                      className="flex-1 p-3 bg-slate-100 text-slate-600 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={handleCreateModule}
                      className="flex-1 p-3 bg-brand-red text-white rounded-xl font-bold hover:bg-brand-red/90 transition-all active:scale-95"
                    >
                      Crear Clase
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {activeTab === 'clases' && (
          <div className="space-y-4 max-w-4xl">
            {modules.map((mod) => (
              <div key={mod.id} className={`bg-white rounded-xl shadow-sm border ${!mod.visible && (profile.role === 'profesor' || profile.role === 'administrador') ? 'border-dashed border-slate-300 opacity-75' : 'border-slate-200'} overflow-hidden`}>
                <div className="flex items-center">
                  <button 
                    type="button"
                    onClick={() => setExpandedModule(expandedModule === mod.id ? null : mod.id)}
                    className="flex-1 p-5 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4">
                      <span className={`w-8 h-8 ${mod.visible ? 'bg-slate-100 text-slate-500' : 'bg-slate-200 text-slate-400'} rounded-full flex items-center justify-center font-bold text-sm`}>
                        {modules.indexOf(mod) + 1}
                      </span>
                      <div className="text-left">
                        <h3 className="font-semibold text-slate-700">{mod.title}</h3>
                        {!mod.visible && (profile.role === 'profesor' || profile.role === 'administrador') && <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Oculto para Alumnos</span>}
                      </div>
                    </div>
                    {expandedModule === mod.id ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                  </button>
                  
                  {(profile.role === 'profesor' || profile.role === 'administrador') && (
                    <div className="flex border-l border-slate-100">
                      <div className="flex flex-col border-r border-slate-100">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleMoveModule(mod.id, 'up'); }}
                          disabled={modules.indexOf(mod) === 0}
                          className="p-2.5 text-slate-400 hover:text-blue-500 disabled:opacity-30 transition-colors"
                          title="Subir"
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleMoveModule(mod.id, 'down'); }}
                          disabled={modules.indexOf(mod) === modules.length - 1}
                          className="p-2.5 border-t border-slate-100 text-slate-400 hover:text-blue-500 disabled:opacity-30 transition-colors"
                          title="Bajar"
                        >
                          <ArrowDown size={16} />
                        </button>
                      </div>
                      <button 
                        onClick={() => editingModule === mod.id ? cancelEditingModule() : startEditingModule(mod)}
                        className={`p-5 hover:bg-slate-50 transition-colors ${editingModule === mod.id ? 'text-red-500' : 'text-slate-400'}`}
                        title="Editar contenido"
                      >
                        {editingModule === mod.id ? <X size={20} /> : <Edit size={20} />}
                      </button>
                      <button 
                        onClick={() => handleToggleVisibility(mod.id, mod.visible)}
                        className={`p-5 border-l border-slate-100 hover:bg-slate-50 transition-colors ${mod.visible ? 'text-brand-red' : 'text-slate-400'}`}
                        title={mod.visible ? "Ocultar clase" : "Mostrar clase"}
                      >
                        {mod.visible ? <Eye size={20} /> : <EyeOff size={20} />}
                      </button>
                    </div>
                  )}
                </div>
                
                <AnimatePresence initial={false}>
                  {expandedModule === mod.id && (
                    <motion.div 
                      key={`content-${mod.id}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="border-t border-slate-100 bg-slate-50/50 overflow-hidden"
                    >
                      <div className="p-6">
                        {editingModule === mod.id ? (
                          <div className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-4">
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Título de la Clase</label>
                                <input 
                                  type="text" 
                                  value={editModuleData.title}
                                  onChange={(e) => setEditModuleData({...editModuleData, title: e.target.value})}
                                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">URL NotebookLM</label>
                                <input 
                                  type="text" 
                                  value={editModuleData.notebookLMUrl || ''}
                                  onChange={(e) => setEditModuleData({...editModuleData, notebookLMUrl: e.target.value})}
                                  placeholder="https://notebooklm.google.com/..."
                                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Descripción</label>
                              <textarea 
                                value={editModuleData.description}
                                onChange={(e) => setEditModuleData({...editModuleData, description: e.target.value})}
                                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm h-24 resize-none"
                              />
                            </div>

                            <div className="grid md:grid-cols-2 gap-8">
                              <div>
                                <div className="flex justify-between items-center mb-4">
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Material de Clase</h4>
                                  <button onClick={() => addMaterial('materials')} className="text-brand-red hover:text-brand-red/80 p-1"><Plus size={16} /></button>
                                </div>
                                <div className="space-y-3">
                                  {editModuleData.materials?.map((mat: any, idx: number) => (
                                    <div key={idx} className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                                      <div className="flex gap-2">
                                        <input 
                                          type="text" 
                                          value={mat.title}
                                          onChange={(e) => updateMaterial('materials', idx, 'title', e.target.value)}
                                          placeholder="Título"
                                          className="flex-1 text-xs p-1 border-b border-slate-100 outline-none"
                                        />
                                        <button onClick={() => removeMaterial('materials', idx)} className="text-red-400 hover:text-red-500"><Trash2 size={14} /></button>
                                      </div>
                                      <div className="flex gap-2">
                                        <div className="flex-1 relative">
                                          <input 
                                            type="text" 
                                            value={mat.url}
                                            onChange={(e) => updateMaterial('materials', idx, 'url', e.target.value)}
                                            placeholder="URL o sube un archivo"
                                            className="w-full text-[10px] p-1 pr-16 border-b border-slate-100 outline-none font-mono"
                                          />
                                          <div className="absolute right-0 top-1/2 -translate-y-1/2 flex gap-1">
                                            <a 
                                              href="https://drive.google.com" 
                                              target="_blank" 
                                              rel="noreferrer"
                                              className="text-slate-400 hover:text-amber-500 transition-colors"
                                              title="Abrir Google Drive"
                                            >
                                              <ExternalLink size={14} />
                                            </a>
                                          <label className="cursor-pointer text-slate-400 hover:text-blue-500 transition-colors flex items-center gap-1">
                                            {uploading === `${editingModule}-materials-${idx}` ? (
                                              <div className="flex items-center gap-1 text-[10px] font-bold text-blue-500">
                                                <Loader2 size={14} className="animate-spin" />
                                                {uploadProgress[`${editingModule}-materials-${idx}`] || 0}%
                                              </div>
                                            ) : (
                                              <FileUp size={14} />
                                            )}
                                            <input 
                                              type="file" 
                                              className="hidden" 
                                              onChange={(e) => handleFileUpload(e, 'materials', idx)}
                                            />
                                          </label>
                                          </div>
                                        </div>
                                        <select 
                                          value={mat.type}
                                          onChange={(e) => updateMaterial('materials', idx, 'type', e.target.value)}
                                          className="text-[10px] bg-slate-50 border-none outline-none"
                                        >
                                          <option value="pdf">PDF</option>
                                          <option value="video">Video</option>
                                        </select>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <div className="flex justify-between items-center mb-4">
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Material Extra</h4>
                                  <button onClick={() => addMaterial('extra')} className="text-brand-red hover:text-brand-red/80 p-1"><Plus size={16} /></button>
                                </div>
                                <div className="space-y-3">
                                  {editModuleData.extra?.map((mat: any, idx: number) => (
                                    <div key={idx} className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                                      <div className="flex gap-2">
                                        <input 
                                          type="text" 
                                          value={mat.title}
                                          onChange={(e) => updateMaterial('extra', idx, 'title', e.target.value)}
                                          placeholder="Título"
                                          className="flex-1 text-xs p-1 border-b border-slate-100 outline-none"
                                        />
                                        <button onClick={() => removeMaterial('extra', idx)} className="text-red-400 hover:text-red-500"><Trash2 size={14} /></button>
                                      </div>
                                      <div className="relative">
                                        <input 
                                          type="text" 
                                          value={mat.url}
                                          onChange={(e) => updateMaterial('extra', idx, 'url', e.target.value)}
                                          placeholder="URL o sube un archivo"
                                          className="w-full text-[10px] p-1 pr-16 border-b border-slate-100 outline-none font-mono"
                                        />
                                        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex gap-1">
                                          <a 
                                            href="https://drive.google.com" 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="text-slate-400 hover:text-amber-500 transition-colors"
                                            title="Abrir Google Drive"
                                          >
                                            <ExternalLink size={14} />
                                          </a>
                                        <label className="cursor-pointer text-slate-400 hover:text-blue-500 transition-colors flex items-center gap-1">
                                          {uploading === `${editingModule}-extra-${idx}` ? (
                                            <div className="flex items-center gap-1 text-[10px] font-bold text-blue-500">
                                              <Loader2 size={14} className="animate-spin" />
                                              {uploadProgress[`${editingModule}-extra-${idx}`] || 0}%
                                            </div>
                                          ) : (
                                            <FileUp size={14} />
                                          )}
                                          <input 
                                            type="file" 
                                            className="hidden" 
                                            onChange={(e) => handleFileUpload(e, 'extra', idx)}
                                          />
                                        </label>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                              <button 
                                onClick={cancelEditingModule}
                                className="flex-1 py-3 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300 transition-colors"
                              >
                                Cancelar
                              </button>
                              <button 
                                onClick={saveModuleChanges}
                                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                              >
                                Guardar Cambios
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-slate-600 mb-6 text-sm leading-relaxed">{mod.description}</p>
                            
                            <div className="grid md:grid-cols-2 gap-8">
                              <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Material de Clase</h4>
                                <div className="space-y-2">
                                  {mod.materials?.map((mat, idx) => (
                                    <a key={idx} href={mat.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 hover:border-blue-400 transition-colors group">
                                      {mat.type === 'pdf' ? <FileIcon size={16} className="text-red-500" /> : <Video size={16} className="text-blue-500" />}
                                      <span className="text-sm text-slate-600 flex-1">{mat.title}</span>
                                      <Download size={14} className="text-slate-300 group-hover:text-blue-500" />
                                    </a>
                                  ))}
                                  
                                  {mod.notebookLMUrl && (
                                    <a href={mod.notebookLMUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100 hover:border-indigo-400 transition-colors group">
                                      <Book size={16} className="text-indigo-600" />
                                      <span className="text-sm text-indigo-700 font-medium flex-1">Libro NotebookLM</span>
                                      <LinkIcon size={14} className="text-indigo-300 group-hover:text-indigo-500" />
                                    </a>
                                  )}

                                  {(profile.role === 'profesor' || profile.role === 'administrador') && (
                                    <div className="mt-4 p-3 bg-white rounded-lg border border-slate-200">
                                      <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">URL NotebookLM</label>
                                      <div className="flex gap-2">
                                        <input 
                                          type="text" 
                                          defaultValue={mod.notebookLMUrl}
                                          onBlur={(e) => handleUpdateNotebookUrl(mod.id, e.target.value)}
                                          placeholder="https://notebooklm.google.com/..."
                                          className="flex-1 text-xs p-1 border-b border-slate-200 focus:border-blue-500 outline-none"
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Material Extra</h4>
                                <div className="space-y-2">
                                  {mod.extra?.map((mat, idx) => (
                                    <a key={idx} href={mat.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 hover:border-blue-400 transition-colors group">
                                      <LinkIcon size={16} className="text-slate-400" />
                                      <span className="text-sm text-slate-600 flex-1">{mat.title}</span>
                                      <Download size={14} className="text-slate-300 group-hover:text-blue-500" />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="mt-8 pt-6 border-t border-slate-100 flex justify-center">
                              <button 
                                onClick={() => setExpandedModule(null)}
                                className="px-8 py-2 bg-slate-100 text-slate-500 rounded-full text-sm font-bold hover:bg-slate-200 transition-colors flex items-center gap-2"
                              >
                                <ChevronUp size={16} /> Volver a la lista
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'foro' && (
          <div className="max-w-3xl space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h4 className="font-semibold text-slate-700 mb-4">Nueva Consulta</h4>
              <div className="flex gap-4">
                <textarea 
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder="Escribe tu duda aquí..."
                  className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                />
              </div>
              <div className="flex justify-end mt-4">
                <button 
                  onClick={handlePostForum}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Send size={16} /> Publicar
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {forum.map(post => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={post.id} 
                  className="bg-white p-6 rounded-xl shadow-sm border border-slate-200"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                        {post.user[0]}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-700">{post.user}</p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-tighter">{new Date(post.date).toLocaleString()}</p>
                      </div>
                    </div>
                    {(profile.role === 'profesor' || profile.role === 'administrador') && (
                      <button 
                        onClick={() => handleDeleteForumPost(post.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors p-1"
                        title="Eliminar consulta"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed">{post.text}</p>
                  
                  {/* Replies */}
                  <div className="mt-6 space-y-4">
                    {post.replies?.map(reply => (
                      <div key={reply.id} className="flex gap-3 pl-6 border-l-2 border-slate-100">
                        <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-[10px] font-bold text-blue-500">
                          {reply.user[0]}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-700">{reply.user}</span>
                              <span className="text-[10px] text-slate-400 uppercase tracking-tighter">{new Date(reply.date).toLocaleString()}</span>
                            </div>
                            {(profile.role === 'profesor' || profile.role === 'administrador') && (
                              <button 
                                onClick={() => handleDeleteForumReply(post.id, reply.id)}
                                className="text-slate-300 hover:text-red-500 transition-colors p-1"
                                title="Eliminar respuesta"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                          <p className="text-slate-600 text-xs leading-relaxed">{reply.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Reply Action */}
                  <div className="mt-4 pt-4 border-t border-slate-50">
                    {replyingTo === post.id ? (
                      <div className="space-y-3">
                        <textarea 
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Escribe tu respuesta..."
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                        />
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => setReplyingTo(null)}
                            className="px-4 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                          >
                            Cancelar
                          </button>
                          <button 
                            onClick={() => handleReplyForum(post.id)}
                            className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
                          >
                            Responder
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setReplyingTo(post.id)}
                        className="flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        <MessageSquare size={14} /> Responder
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'tareas' && profile && (
          <div className="max-w-5xl mx-auto space-y-8">
            {/* Filters & Search */}
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Buscar tarea por título..."
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:border-brand-red transition-all"
                />
              </div>
              
              <div className="flex bg-slate-100 p-1 rounded-2xl w-full md:w-auto">
                <button 
                  onClick={() => setTaskFilter('all')}
                  className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all ${taskFilter === 'all' ? 'bg-white text-brand-red shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Todas
                </button>
                <button 
                  onClick={() => setTaskFilter('pending')}
                  className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all ${taskFilter === 'pending' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Pendientes
                </button>
                <button 
                  onClick={() => setTaskFilter('completed')}
                  className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all ${taskFilter === 'completed' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Entregadas
                </button>
              </div>
            </div>

            {/* Admin/Teacher View: Task Management & Submissions */}
            {(profile.role === 'profesor' || profile.role === 'administrador') && (
              <div className="space-y-12">
                {/* Task List for Admin */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <FileText size={18} className="text-brand-red" /> Listado de Tareas Publicadas
                  </h3>
                  <div className="grid gap-4">
                    {tasks.map((task, idx) => (
                      <div key={task.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-brand-red/20 transition-colors">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="flex flex-col gap-1 shrink-0">
                            <button 
                              disabled={idx === 0}
                              onClick={() => handleMoveTask(task.id, 'up')}
                              className="text-slate-300 hover:text-blue-500 disabled:opacity-30"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button 
                              disabled={idx === tasks.length - 1}
                              onClick={() => handleMoveTask(task.id, 'down')}
                              className="text-slate-300 hover:text-blue-500 disabled:opacity-30"
                            >
                              <ArrowDown size={14} />
                            </button>
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-700 truncate">{task.title}</h4>
                            <p className="text-xs text-slate-400">Límite: {new Date(task.deadline).toLocaleDateString(undefined, { timeZone: 'UTC' })}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => { setEditingTask(task.id); setEditTaskData({...task}); }}
                            className="p-2 text-slate-400 hover:text-brand-red hover:bg-brand-red/5 rounded-lg transition-all"
                          >
                            <Edit size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Submissions Table */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <History size={18} className="text-brand-red" /> Historial de Entregas Recibidas
                    </h3>
                    <span className="text-[10px] font-black uppercase bg-brand-red/10 text-brand-red px-2 py-1 rounded-lg">
                      {submissions.length} Total
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50/50">
                          <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Alumno</th>
                          <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Tarea</th>
                          <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Fecha</th>
                          <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Archivo/Link</th>
                          <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Estado</th>
                          <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {submissions.map(sub => (
                          <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-brand-red/10 text-brand-red flex items-center justify-center font-bold text-xs">
                                  {sub.studentName.charAt(0)}
                                </div>
                                <span className="text-sm font-bold text-slate-700">{sub.studentName}</span>
                              </div>
                            </td>
                            <td className="p-4 text-sm text-slate-600 font-medium">{sub.taskTitle || 'Tarea'}</td>
                            <td className="p-4 text-xs text-slate-400">{new Date(sub.date).toLocaleDateString()}</td>
                            <td className="p-4">
                              <a 
                                href={sub.fileUrl} 
                                target="_blank" 
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-red hover:text-brand-red/80 bg-brand-red/10 px-3 py-1.5 rounded-lg transition-colors"
                              >
                                <ExternalLink size={12} /> Ver Entrega
                              </a>
                            </td>
                            <td className="p-4">
                              <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${
                                sub.status === 'Calificado' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {sub.status}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                {sub.status !== 'Calificado' && (
                                  <button 
                                    onClick={() => handleGradeSubmission(sub.id)}
                                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                    title="Marcar como calificada"
                                  >
                                    <CheckCircle size={18} />
                                  </button>
                                )}
                                <button 
                                  onClick={() => handleDeleteSubmission(sub.id)}
                                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Eliminar entrega"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {submissions.length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-12 text-center">
                              <div className="flex flex-col items-center opacity-20">
                                <History size={48} className="mb-4" />
                                <p className="text-sm font-bold italic">No hay entregas registradas aún.</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Student View: Task List & Submission */}
            <div className="grid gap-6">
              {tasks
                .filter(t => t.title.toLowerCase().includes(taskSearch.toLowerCase()))
                .filter(t => {
                  const sub = submissions.find(s => s.taskId === t.id);
                  if (taskFilter === 'pending') return !sub;
                  if (taskFilter === 'completed') return !!sub;
                  return true;
                })
                .map(task => {
                  const submission = submissions.find(s => s.taskId === task.id);
                  return (
                    <motion.div 
                      layout
                      key={task.id} 
                      className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden group hover:shadow-md transition-all"
                    >
                      <div className="p-8">
                        <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
                          <div className="flex-1 min-w-0 w-full">
                            <div className="flex items-center gap-3 mb-4">
                              <span className="bg-brand-red/10 text-brand-red p-2.5 rounded-2xl shrink-0">
                                <FileText size={24} />
                              </span>
                              <h3 className="text-xl md:text-2xl font-black text-brand-dark tracking-tight group-hover:text-brand-red transition-colors truncate">{task.title}</h3>
                            </div>
                            <div className="prose prose-slate prose-sm max-w-none text-slate-600 leading-relaxed bg-brand-gray/50 p-4 md:p-6 rounded-2xl border border-slate-100">
                              <Markdown>{task.description}</Markdown>
                            </div>
                            {task.attachmentUrl && (
                              <div className="mt-4 flex items-center gap-3 bg-brand-red/5 p-4 rounded-2xl border border-brand-red/10 overflow-hidden">
                                <div className="bg-brand-red/10 p-2 rounded-xl text-brand-red shrink-0">
                                  <LinkIcon size={18} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-black text-brand-red uppercase tracking-wider mb-0.5">Material de la Tarea</p>
                                  <a 
                                    href={task.attachmentUrl} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="text-sm font-bold text-brand-red hover:text-brand-red/80 truncate block transition-colors"
                                  >
                                    {task.attachmentUrl}
                                  </a>
                                </div>
                                <a 
                                  href={task.attachmentUrl} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="p-2 bg-white text-brand-red rounded-xl border border-brand-red/10 shadow-sm hover:bg-brand-red/5 transition-all shrink-0"
                                >
                                  <ExternalLink size={16} />
                                </a>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-start gap-3 w-full md:w-auto md:min-w-[160px] pt-4 md:pt-0 border-t md:border-t-0 border-slate-100">
                            {submission ? (
                              <div className={`flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-2xl font-black text-[10px] uppercase tracking-wider shrink-0 ${
                                submission.status === 'Calificado' ? 'bg-green-100 text-green-700' : 'bg-brand-red/10 text-brand-red'
                              }`}>
                                {submission.status === 'Calificado' ? (
                                  <><CheckCircle size={14} /> Aprobado</>
                                ) : (
                                  <><Clock size={14} /> Entregada</>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-2xl font-black text-[10px] uppercase tracking-wider bg-slate-100 text-slate-500 shrink-0">
                                <AlertCircle size={14} /> Pendiente
                              </div>
                            )}
                            
                            <div className="flex items-center gap-2 text-[10px] md:text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 shrink-0">
                              <Clock size={14} /> Límite: {new Date(task.deadline).toLocaleDateString(undefined, { timeZone: 'UTC' })}
                            </div>
                          </div>
                        </div>

                        {!submission && profile.role === 'alumno' && (
                          <div className="mt-8 pt-8 border-t border-slate-100">
                            <div className="bg-brand-red/5 border border-brand-red/10 p-5 rounded-2xl flex gap-4 items-start mb-6">
                              <div className="bg-brand-red/10 p-2 rounded-xl text-brand-red mt-0.5">
                                <Info size={20} />
                              </div>
                              <div className="text-sm text-brand-red leading-relaxed">
                                <p className="font-black mb-1">Instrucciones de Entrega</p>
                                <p>Sube tu archivo a una plataforma de almacenamiento (Google Drive, Dropbox, etc.) y pega el enlace público aquí. Asegúrate de que el archivo sea accesible para el profesor.</p>
                              </div>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row gap-3">
                              <div className="relative flex-1">
                                <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input 
                                  type="text" 
                                  placeholder="Pega aquí el enlace a tu tarea..."
                                  value={submissionUrl[task.id] || ''}
                                  onChange={(e) => setSubmissionUrl(prev => ({ ...prev, [task.id]: e.target.value }))}
                                  className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:border-brand-red focus:ring-4 focus:ring-brand-red/5 transition-all"
                                />
                              </div>
                              <button 
                                onClick={() => handleLinkSubmission(task.id, task.title)}
                                disabled={uploading === `submission-${task.id}`}
                                className="px-8 py-4 bg-brand-red text-white rounded-2xl font-black hover:bg-brand-red/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-brand-red/20 active:scale-95"
                              >
                                {uploading === `submission-${task.id}` ? (
                                  <Loader2 size={20} className="animate-spin" />
                                ) : (
                                  <>
                                    <Send size={20} /> Enviar Tarea
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {submission && (
                          <div className="mt-8 pt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-6">
                            <div className="flex items-center gap-4">
                              <div className="w-16 h-16 rounded-3xl bg-brand-red/5 border border-brand-red/10 flex items-center justify-center text-brand-red">
                                <ExternalLink size={28} />
                              </div>
                              <div>
                                <p className="text-sm font-black text-brand-dark">Tu Entrega</p>
                                <p className="text-xs text-slate-400 mb-2">Enviado el {new Date(submission.date).toLocaleDateString()}</p>
                                <a 
                                  href={submission.fileUrl} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="inline-flex items-center gap-2 text-xs font-bold text-brand-red hover:text-brand-red/80 bg-brand-red/10 px-4 py-2 rounded-xl transition-all group/link"
                                >
                                  Ver enlace enviado <ExternalLink size={12} className="group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                                </a>
                              </div>
                            </div>
                            
                            {submission.status === 'Calificado' && (
                              <div className="flex items-center gap-4 bg-green-50 px-8 py-4 rounded-[24px] border border-green-100">
                                <div className="bg-green-100 p-2 rounded-xl text-green-600">
                                  <CheckCircle size={24} />
                                </div>
                                <div>
                                  <p className="text-sm font-black text-green-800 uppercase tracking-wider">Tarea Aprobada</p>
                                  <p className="text-xs text-green-600 font-bold">¡Excelente trabajo!</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              
              {tasks.length === 0 && (
                <div className="p-24 text-center bg-white rounded-[40px] border border-dashed border-slate-200 text-slate-400">
                  <div className="bg-slate-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FileText size={48} className="opacity-20" />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 mb-2">No hay tareas disponibles</h3>
                  <p className="text-sm max-w-xs mx-auto">¡Buen trabajo! Estás al día con tus entregas o aún no se han publicado tareas.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'admin' && (profile.role === 'profesor' || profile.role === 'administrador') && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
              <div className="p-4 bg-slate-50 border-b border-slate-200 min-w-full">
                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                  <UserPlus size={18} /> Gestión de Usuarios y Roles
                </h3>
              </div>
              <table className="w-full text-left min-w-[600px]">
                <thead className="bg-slate-50 border-bottom border-slate-200">
                  <tr>
                    <th className="p-4 text-xs font-bold uppercase text-slate-400">Nombre</th>
                    <th className="p-4 text-xs font-bold uppercase text-slate-400">Email</th>
                    <th className="p-4 text-xs font-bold uppercase text-slate-400">Rol Actual</th>
                    <th className="p-4 text-xs font-bold uppercase text-slate-400">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allUsers.map(u => (
                    <tr key={u.uid} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 text-sm font-medium text-slate-700">{u.displayName}</td>
                      <td className="p-4 text-sm text-slate-500">{u.email}</td>
                      <td className="p-4">
                        <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${
                          u.role === 'profesor' ? 'bg-brand-red/10 text-brand-red' : 
                          u.role === 'administrador' ? 'bg-brand-dark text-white' : 
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="p-4 flex gap-2 items-center">
                        <select 
                          value={u.role}
                          onChange={(e) => handleUpdateUserRole(u.uid, e.target.value as UserRole)}
                          className="text-xs p-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="alumno">Alumno</option>
                          <option value="profesor">Profesor</option>
                          <option value="administrador">Administrador</option>
                        </select>
                        {u.status === 'pending' && (
                          <button 
                            onClick={() => handleApproveUser(u.uid)}
                            className="bg-brand-red text-white px-3 py-1 rounded text-[10px] font-bold hover:bg-brand-red/90 transition-all active:scale-95"
                          >
                            Aprobar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* New Task Modal */}
        {showNewTaskModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-800">Crear Nueva Tarea</h3>
                <button onClick={() => setShowNewTaskModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Título de la Tarea</label>
                  <input 
                    type="text" 
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Ej: Ensayo sobre Ética en IA"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Descripción</label>
                  <textarea 
                    value={newTaskDescription}
                    onChange={(e) => setNewTaskDescription(e.target.value)}
                    placeholder="Detalla las instrucciones de la tarea..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm h-32 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Fecha Límite</label>
                  <input 
                    type="date" 
                    value={newTaskDeadline}
                    onChange={(e) => setNewTaskDeadline(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Link de Material Adjunto (Drive/Dropbox)</label>
                  <input 
                    type="text" 
                    value={newTaskAttachmentUrl}
                    onChange={(e) => setNewTaskAttachmentUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button 
                  onClick={handleCreateTask}
                  className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                >
                  Publicar Tarea
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Edit Task Modal */}
        {editingTask && editTaskData && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-800">Editar Tarea</h3>
                <button onClick={() => setEditingTask(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Título</label>
                  <input 
                    type="text" 
                    value={editTaskData.title}
                    onChange={(e) => setEditTaskData({...editTaskData, title: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Descripción</label>
                  <textarea 
                    value={editTaskData.description}
                    onChange={(e) => setEditTaskData({...editTaskData, description: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm h-32 resize-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Fecha Límite</label>
                  <input 
                    type="date" 
                    value={editTaskData.deadline?.split('T')[0] || ''}
                    onChange={(e) => setEditTaskData({...editTaskData, deadline: new Date(e.target.value).toISOString()})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Link de Material Adjunto</label>
                  <input 
                    type="text" 
                    value={editTaskData.attachmentUrl || ''}
                    onChange={(e) => setEditTaskData({...editTaskData, attachmentUrl: e.target.value})}
                    placeholder="https://drive.google.com/..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setEditingTask(null)}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleUpdateTask}
                    className="flex-1 py-3 bg-brand-red text-white rounded-xl font-bold hover:bg-brand-red/90 transition-all shadow-lg shadow-brand-red/10 active:scale-95"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
        {/* Confirmation Modal */}
        <AnimatePresence>
          {confirmModal.show && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden"
              >
                <div className="p-6">
                  <h3 className="text-lg font-bold text-slate-800 mb-2">{confirmModal.title}</h3>
                  <p className="text-slate-600 text-sm">{confirmModal.message}</p>
                </div>
                <div className="bg-slate-50 p-4 flex justify-end gap-3">
                  <button 
                    onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={confirmModal.onConfirm}
                    className="bg-brand-red text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-brand-red/90 transition-all active:scale-95"
                  >
                    Eliminar
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
