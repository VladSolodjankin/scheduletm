import axios from 'axios';

const runtimeOrigin = typeof window === 'undefined' ? undefined : window.location.origin;

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? runtimeOrigin ?? 'http://localhost:3000',
  withCredentials: true
});

export const authHeaders = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`
});
