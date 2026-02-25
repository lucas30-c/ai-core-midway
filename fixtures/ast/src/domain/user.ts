import { query } from '../infra/db'; // VIOLATION: domain -> infra
export const getUser = () => query('users');
