export interface Material {
  id: string;
  type: 'pdf' | 'video' | 'link';
  title: string;
  url: string;
}

export interface Task {
  id: string;
  title: string;
  deadline: string;
  description: string;
  order?: number;
  attachmentUrl?: string;
}

export interface ClassModule {
  id: string;
  order?: number;
  title: string;
  description: string;
  materials: Material[];
  extra: Material[];
  task: Task | null;
  visible: boolean;
  notebookLMUrl?: string;
}

export interface ForumPost {
  id: string;
  user: string;
  text: string;
  date: string;
  uid: string;
  replies?: ForumPost[];
}

export interface Submission {
  id: string;
  studentName: string;
  studentUid: string;
  taskId: string;
  taskTitle: string;
  fileName: string;
  fileUrl: string;
  date: string;
  status: 'Recibido' | 'Calificado';
}

export type UserRole = 'profesor' | 'alumno' | 'administrador';
export type UserStatus = 'pending' | 'approved';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
}
