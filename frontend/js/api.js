const API = (() => {
  const BASE = '/api';
  const headers = () => ({
    'Content-Type': 'application/json',
    ...(localStorage.getItem('tf_token') ? { Authorization: `Bearer ${localStorage.getItem('tf_token')}` } : {})
  });

  const req = async (method, path, body) => {
    const res = await fetch(BASE + path, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Errore server');
    return data;
  };

  return {
    login: (email, password) => req('POST', '/users/login', { email, password }),
    register: (name, email, password) => req('POST', '/users/register', { name, email, password }),
    me: () => req('GET', '/users/me'),
    users: () => req('GET', '/users'),
    projects: () => req('GET', '/projects'),
    createProject: (d) => req('POST', '/projects', d),
    updateProject: (id, d) => req('PUT', `/projects/${id}`, d),
    deleteProject: (id) => req('DELETE', `/projects/${id}`),
    tasks: (params = {}) => req('GET', '/tasks?' + new URLSearchParams(params)),
    createTask: (d) => req('POST', '/tasks', d),
    updateTask: (id, d) => req('PUT', `/tasks/${id}`, d),
    deleteTask: (id) => req('DELETE', `/tasks/${id}`),
    logTime: (id, minutes, note) => req('POST', `/tasks/${id}/log`, { minutes, note }),
    stats: () => req('GET', '/tasks/stats/summary'),
  };
})();