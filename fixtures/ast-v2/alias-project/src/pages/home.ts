// pages/home.ts - imports using @/ alias
import { getUser } from '@/domain/user';

export const page = () => getUser();
