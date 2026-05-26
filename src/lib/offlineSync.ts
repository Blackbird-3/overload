import { databases } from "./appwrite";
import { ID } from "appwrite";

interface OfflineMutation {
  id: string;
  action: 'create' | 'update' | 'delete';
  databaseId: string;
  collectionId: string;
  documentId: string;
  data?: any;
  timestamp: number;
}

function applyOptimisticCache(collectionId: string, action: string, documentId: string, data?: any) {
  if (typeof window === 'undefined') return;
  
  const userId = data?.userId;
  if (userId) {
    // Initialize default cache keys if they don't exist so offline writes are cached immediately
    if (collectionId === 'routines') {
      const k = `cache_routines_equal("userId", "${userId}")_limit(100)`;
      if (!localStorage.getItem(k)) localStorage.setItem(k, '[]');
    } else if (collectionId === 'workouts') {
      const k = `cache_workouts_equal("userId", "${userId}")_orderDesc("$createdAt")_limit(5000)`;
      if (!localStorage.getItem(k)) localStorage.setItem(k, '[]');
    } else if (collectionId === 'sets') {
      const k = `cache_sets_equal("userId", "${userId}")_limit(5000)`;
      if (!localStorage.getItem(k)) localStorage.setItem(k, '[]');
    }
  }

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(`cache_${collectionId}`)) {
      try {
        let docs = JSON.parse(localStorage.getItem(key) || '[]');
        if (action === 'create') {
          const newDoc = { $id: documentId, ...data, $createdAt: new Date().toISOString() };
          // If the query orders descending, put new items at the top. Otherwise, bottom.
          if (key.includes('orderDesc')) {
            docs.unshift(newDoc);
          } else {
            docs.push(newDoc);
          }
        } else if (action === 'update') {
          docs = docs.map((d: any) => d.$id === documentId ? { ...d, ...data } : d);
        } else if (action === 'delete') {
          docs = docs.filter((d: any) => d.$id !== documentId);
        }
        localStorage.setItem(key, JSON.stringify(docs));
      } catch (e) {
        console.error("Cache update failed", e);
      }
    }
  }
}

function queueMutation(mutation: Omit<OfflineMutation, 'id' | 'timestamp'>) {
  if (typeof window === 'undefined') return;
  const queue = JSON.parse(localStorage.getItem('offline_mutations') || '[]');
  queue.push({
    ...mutation,
    id: ID.unique(),
    timestamp: Date.now()
  });
  localStorage.setItem('offline_mutations', JSON.stringify(queue));
  
  // Update read cache so UI updates instantly
  applyOptimisticCache(mutation.collectionId, mutation.action, mutation.documentId, mutation.data);
}

export const offlineSync = {
  async listDocuments(databaseId: string, collectionId: string, queries: string[] = []) {
    const cacheKey = `cache_${collectionId}_${queries.join('_')}`;
    try {
      const res = await databases.listDocuments(databaseId, collectionId, queries);
      if (typeof window !== 'undefined') {
        localStorage.setItem(cacheKey, JSON.stringify(res.documents));
      }
      return res;
    } catch (e) {
      console.warn("Offline: loading from cache", collectionId);
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          return { documents: JSON.parse(cached), total: JSON.parse(cached).length };
        } else {
          // Initialize empty cache so optimistic updates can find it
          localStorage.setItem(cacheKey, '[]');
        }
      }
      return { documents: [], total: 0 };
    }
  },

  async createDocument(databaseId: string, collectionId: string, documentId: string, data: any) {
    try {
      const res = await databases.createDocument(databaseId, collectionId, documentId, data);
      applyOptimisticCache(collectionId, 'create', res.$id, data);
      return res;
    } catch (e) {
      console.warn("Offline: queueing create mutation", collectionId);
      const actualDocId = documentId === 'unique()' ? ID.unique() : documentId;
      queueMutation({ action: 'create', databaseId, collectionId, documentId: actualDocId, data });
      return { $id: actualDocId, ...data };
    }
  },

  async updateDocument(databaseId: string, collectionId: string, documentId: string, data: any) {
    try {
      const res = await databases.updateDocument(databaseId, collectionId, documentId, data);
      applyOptimisticCache(collectionId, 'update', documentId, data);
      return res;
    } catch (e) {
      console.warn("Offline: queueing update mutation", collectionId);
      queueMutation({ action: 'update', databaseId, collectionId, documentId, data });
      return { $id: documentId, ...data };
    }
  },

  async deleteDocument(databaseId: string, collectionId: string, documentId: string) {
    try {
      const res = await databases.deleteDocument(databaseId, collectionId, documentId);
      applyOptimisticCache(collectionId, 'delete', documentId);
      return res;
    } catch (e) {
      console.warn("Offline: queueing delete mutation", collectionId);
      queueMutation({ action: 'delete', databaseId, collectionId, documentId });
      return true;
    }
  },

  async sync() {
    if (typeof window === 'undefined') return;
    const queue: OfflineMutation[] = JSON.parse(localStorage.getItem('offline_mutations') || '[]');
    if (queue.length === 0) return;

    console.log(`Syncing ${queue.length} offline mutations...`);
    const newQueue = [];
    
    for (const m of queue) {
      try {
        if (m.action === 'create') {
          await databases.createDocument(m.databaseId, m.collectionId, m.documentId, m.data);
        } else if (m.action === 'update') {
          await databases.updateDocument(m.databaseId, m.collectionId, m.documentId, m.data);
        } else if (m.action === 'delete') {
          await databases.deleteDocument(m.databaseId, m.collectionId, m.documentId);
        }
      } catch (e: any) {
        if (e.code !== 409 && e.code !== 404) {
          newQueue.push(m);
        }
      }
    }

    localStorage.setItem('offline_mutations', JSON.stringify(newQueue));
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => offlineSync.sync());
  setInterval(() => {
    if (navigator.onLine) offlineSync.sync();
  }, 1000 * 30);
}
