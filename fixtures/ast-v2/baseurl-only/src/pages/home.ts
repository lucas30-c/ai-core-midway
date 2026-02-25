// pages/home.ts - imports using baseUrl only (no paths)
import { getUser } from 'domain/user';

export const page = () => getUser();
