import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from './apiClient';

const OFFLINE_QUEUE_KEY = 'hersentinel.offlineSyncQueue.v1';
const MAX_RETRIES = 8;

const safeParseJson = value => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
};

const readQueue = async () => {
  const rawValue = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
  return safeParseJson(rawValue);
};

const writeQueue = async queue => {
  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
};

const toFormData = evidence => {
  const formData = new FormData();

  if (evidence?.type) {
    formData.append('type', evidence.type);
  }

  if (evidence?.text) {
    formData.append('text', evidence.text);
  }

  if (evidence?.mediaUrl) {
    formData.append('mediaUrl', evidence.mediaUrl);
  }

  if (evidence?.file) {
    formData.append('file', {
      uri: evidence.file.uri,
      type: evidence.file.type || 'application/octet-stream',
      name: evidence.file.name || `evidence-${Date.now()}`,
    });
  }

  return formData;
};

const replayItem = async item => {
  if (item.type === 'location') {
    await apiClient.post(`/emergencies/${item.eventId}/location`, {
      ...(item.payload || {}),
    });
    return;
  }

  if (item.type === 'evidence') {
    if (item.payload?.file) {
      const formData = toFormData(item.payload);
      await apiClient.post(`/emergencies/${item.eventId}/evidence`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return;
    }

    await apiClient.post(`/emergencies/${item.eventId}/evidence`, {
      ...(item.payload || {}),
    });
  }
};

const enqueue = async item => {
  const queue = await readQueue();

  const nextItem = {
    id: item.id || `${item.type}-${item.eventId}-${Date.now()}`,
    type: item.type,
    eventId: item.eventId,
    payload: item.payload,
    createdAt: item.createdAt || new Date().toISOString(),
    retries: item.retries || 0,
  };

  queue.push(nextItem);
  await writeQueue(queue);

  return nextItem;
};

const flush = async () => {
  const queue = await readQueue();
  if (queue.length === 0) {
    return { success: true, flushed: 0, pending: 0 };
  }

  const remaining = [];
  let flushed = 0;

  for (const item of queue) {
    try {
      await replayItem(item);
      flushed += 1;
    } catch (error) {
      const nextRetries = (item.retries || 0) + 1;
      const shouldKeep = !error.response || error.response?.status >= 500;

      if (shouldKeep && nextRetries <= MAX_RETRIES) {
        remaining.push({
          ...item,
          retries: nextRetries,
          lastError: error.message,
        });
      }
    }
  }

  await writeQueue(remaining);

  return {
    success: true,
    flushed,
    pending: remaining.length,
  };
};

const getPendingCount = async () => {
  const queue = await readQueue();
  return queue.length;
};

const offlineSyncService = {
  enqueue,
  flush,
  getPendingCount,
};

export default offlineSyncService;
