import { getUser } from '../domain/user'; // VIOLATION: pages -> domain
export const page = () => getUser();
