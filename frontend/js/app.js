let currentUser = null;
let allProjects = [];
let allUsers = [];
let allTasks = [];

const $ = id => document.getElementById(id);
const show = el => el.classList.remove('hidden');
const hide = el => el.classList.add('hidden');

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function priorityBadge(p) {
  const map = { high: ['alta', 'badge-red'], medium: ['media', 'badge-amber'], low: ['bassa', 'badge-green'] };
  const [label, cls] = map[p] || ['—', 'badge-gray'];
  return `<span class="badge ${cls}">${label}</span>`;
}

function statusBadge(s) {
  const map = { todo: ['Da fare', 'badge-gray'], in_progress: ['In corso', 'badge-blue'], review: ['Revisione', 'badge-amber'], done: ['Fatto', 'badge-green'] };
  const [label, cls] = map[s] || [s, 'badge-gray'];
  return `<span class="badge ${cls}">${label}</span>`;
}

async function init() {
  const token = localStorage.getItem('tf_token');
  if (!token) return showAuth();
  try {
    currentUser = await API.me();
    await showApp();
  } catch { showAuth(); }
}

function showAuth() {
  show($('auth-screen'));
  hide($('app'));
}

async function showApp() {
  hide($('auth-screen'));
  show($('app'));
  $('nav-avatar').textContent = currentUser.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  $('nav-avatar').style.background = currentUser.avatar_color || '#6366f1';
  [allProjects, allUsers] = await Promise.all([API.projects(), API.users()]);
  populateProjectFilters();
  await navigateTo('dashboard');
}

function populateProjectFilters() {
  ['filter-project', 'kanban-project-filter'].forEach(id => {
    const sel = $(id);
    if (!sel) return;
    const opts = allProjects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    sel.innerHTML = `<option value="">Tutti i progetti</option>${opts}`;
  });
}

async function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  show($(`page-${page}`));
  const link = document.querySelector(`[data-page="${page}"]`);
  if (link) link.classList.add('active');
  if (page === 'dashboard') await renderDashboard();
  if (page === 'projects') renderProjects();
  if (page === 'tasks') await renderTasks();
  if (page === 'kanban') await renderKanban();
}

async function renderDashboard() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buonasera';
  $('dashboard-greeting').textContent = `${greeting}, ${currentUser.name.split(' ')[0]} 👋`;

  const stats = await API.stats();

  const statItems = [
    { label: 'Task totali', value: stats.total, icon: '📋' },
    { label: 'Completati', value: stats.done, icon: '✅' },
    { label: 'In corso', value: stats.inprogress, icon: '⚡' },
    { label: 'Scaduti', value: stats.overdue, icon: '⚠️', warn: stats.overdue > 0 },
    { label: 'Ore tracciate', value: (stats.totalMinutes / 60).toFixed(1) + 'h', icon: '⏱️' },
    { label: 'Progetti', value: stats.byProject.length, icon: '📁' },
  ];

  $('stats-grid').innerHTML = statItems.map(s => `
    <div class="stat-card${s.warn ? ' stat-warn' : ''}">
      <div class="stat-icon">${s.icon}</div>
      <div class="stat-value">${s.value}</div>
      <div class="stat-label">${s.label}</div>
    </div>
  `).join('');

  Charts.renderHours(stats.byDay);
  Charts.renderProjects(stats.byProject);

  const tasks = await API.tasks();
  $('recent-tasks').innerHTML = tasks.slice(0, 6).map(taskRow).join('')
    || '<p class="empty">Nessun task ancora. Creane uno dalla sezione Task.</p>';
}

function renderProjects() {
  if (!allProjects.length) {
    $('projects-grid').innerHTML = '<p class="empty">Nessun progetto. Creane uno!</p>';
    return;
  }
  $('projects-grid').innerHTML = allProjects.map(p => {
    const pct = p.task_count ? Math.round((p.done_count / p.task_count) * 100) : 0;
    return `
    <div class="project-card" style="border-top: 3px solid ${p.color || '#6366f1'}">
      <div class="project-card-header">
        <h3>${p.name}</h3>
        <div class="project-actions">
          <button class="btn-icon" onclick="event.stopPropagation();openEditProject(${p.id})" title="Modifica">✏️</button>
          <button class="btn-icon" onclick="event.stopPropagation();deleteProject(${p.id})" title="Elimina">🗑️</button>
        </div>
      </div>
      <p class="project-desc">${p.description || 'Nessuna descrizione'}</p>
      <div class="progress-bar">
        <div class="progress-fill" style="width:${pct}%;background:${p.color || '#6366f1'}"></div>
      </div>
      <div class="project-meta">
        <span>${p.done_count}/${p.task_count} task completati</span>
        ${p.deadline ? `<span>📅 ${formatDate(p.deadline)}</span>` : ''}
      </div>
      <button class="btn-ghost small" style="align-self:flex-start" onclick="navigateTo('tasks');setTimeout(()=>{$('filter-project').value='${p.id}';renderTasks();},80)">
        Vedi task →
      </button>
    </div>`;
  }).join('');
}

async function renderTasks() {
  const params = {};
  const fp = $('filter-project')?.value;
  const fs = $('filter-status')?.value;
  if (fp) params.project_id = fp;
  if (fs) params.status = fs;
  allTasks = await API.tasks(params);
  $('tasks-list').innerHTML = allTasks.map(taskRow).join('') || '<p class="empty">Nessun task trovato.</p>';
}

function taskRow(t) {
  return `
  <div class="task-row" onclick="openTaskDetail(${t.id})">
    <div class="task-row-main">
      <span class="task-title">${t.title}</span>
      ${t.project_name ? `<span class="task-project" style="background:${t.project_color}20;color:${t.project_color}">${t.project_name}</span>` : ''}
    </div>
    <div class="task-row-meta">
      ${statusBadge(t.status)}
      ${priorityBadge(t.priority)}
      ${t.due_date ? `<span class="task-date">📅 ${formatDate(t.due_date)}</span>` : ''}
      ${t.assignee_name ? `<span class="avatar-mini" style="background:${t.assignee_color}">${t.assignee_name.slice(0,2).toUpperCase()}</span>` : ''}
    </div>
  </div>`;
}

async function renderKanban() {
  const params = {};
  const fp = $('kanban-project-filter')?.value;
  if (fp) params.project_id = fp;
  allTasks = await API.tasks(params);
  const cols = ['todo', 'in_progress', 'review', 'done'];
  cols.forEach(status => {
    const cards = allTasks.filter(t => t.status === status);
    const container = $(`kanban-${status}`);
    if (!container) return;
    $(`count-${status}`).textContent = cards.length;
    container.innerHTML = cards.map(t => `
      <div class="kanban-card" draggable="true" data-id="${t.id}" onclick="openTaskDetail(${t.id})">
        <div class="kanban-card-title">${t.title}</div>
        ${t.project_name ? `<div class="kanban-card-project" style="color:${t.project_color}">${t.project_name}</div>` : ''}
        <div class="kanban-card-footer">
          ${priorityBadge(t.priority)}
          ${t.assignee_name ? `<span class="avatar-mini small" style="background:${t.assignee_color}">${t.assignee_name.slice(0,2).toUpperCase()}</span>` : ''}
        </div>
      </div>
    `).join('');
  });
  initDragDrop();
}

function initDragDrop() {
  let dragId = null;
  document.querySelectorAll('.kanban-card').forEach(card => {
    card.addEventListener('dragstart', e => { dragId = card.dataset.id; card.classList.add('dragging'); e.stopPropagation(); });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });
  document.querySelectorAll('.kanban-cards').forEach(col => {
    col.addEventListener('dragover', e => e.preventDefault());
    col.addEventListener('drop', async e => {
      e.preventDefault();
      if (!dragId) return;
      const newStatus = col.closest('.kanban-col').dataset.status;
      const task = allTasks.find(t => t.id == dragId);
      if (task && task.status !== newStatus) {
        await API.updateTask(dragId, { ...task, status: newStatus, tags: JSON.parse(task.tags || '[]') });
        await renderKanban();
      }
      dragId = null;
    });
  });
}

function openModal(title, bodyHTML) {
  $('modal-title').textContent = title;
  $('modal-body').innerHTML = bodyHTML;
  show($('modal-overlay'));
}

function closeModal() { hide($('modal-overlay')); }

function openNewProject() {
  openModal('Nuovo progetto', `
    <div class="form-grid">
      <div class="field-group"><label>Nome *</label><input id="f-name" type="text" placeholder="Es. App Mobile"/></div>
      <div class="field-group"><label>Descrizione</label><textarea id="f-desc" rows="2" placeholder="Descrizione opzionale"></textarea></div>
      <div class="field-group"><label>Scadenza</label><input id="f-deadline" type="date"/></div>
      <div class="field-group"><label>Colore</label><input id="f-color" type="color" value="#6366f1" style="height:40px;width:60px;padding:2px;border-radius:8px"/></div>
    </div>
    <button class="btn-primary" onclick="submitNewProject()">Crea progetto</button>
  `);
}

async function submitNewProject() {
  const name = $('f-name').value.trim();
  if (!name) return alert('Nome obbligatorio');
  await API.createProject({ name, description: $('f-desc').value, deadline: $('f-deadline').value, color: $('f-color').value });
  allProjects = await API.projects();
  populateProjectFilters();
  renderProjects();
  closeModal();
}

function openEditProject(id) {
  const p = allProjects.find(x => x.id === id);
  if (!p) return;
  openModal('Modifica progetto', `
    <div class="form-grid">
      <div class="field-group"><label>Nome</label><input id="f-name" type="text" value="${p.name}"/></div>
      <div class="field-group"><label>Descrizione</label><textarea id="f-desc" rows="2">${p.description || ''}</textarea></div>
      <div class="field-group"><label>Stato</label>
        <select id="f-status">
          <option value="active" ${p.status === 'active' ? 'selected' : ''}>Attivo</option>
          <option value="completed" ${p.status === 'completed' ? 'selected' : ''}>Completato</option>
          <option value="archived" ${p.status === 'archived' ? 'selected' : ''}>Archiviato</option>
        </select>
      </div>
      <div class="field-group"><label>Scadenza</label><input id="f-deadline" type="date" value="${p.deadline || ''}"/></div>
      <div class="field-group"><label>Colore</label><input id="f-color" type="color" value="${p.color}" style="height:40px;width:60px;padding:2px;border-radius:8px"/></div>
    </div>
    <button class="btn-primary" onclick="submitEditProject(${id})">Salva modifiche</button>
  `);
}

async function submitEditProject(id) {
  await API.updateProject(id, { name: $('f-name').value, description: $('f-desc').value, status: $('f-status').value, deadline: $('f-deadline').value, color: $('f-color').value });
  allProjects = await API.projects();
  populateProjectFilters();
  renderProjects();
  closeModal();
}

async function deleteProject(id) {
  if (!confirm('Eliminare il progetto e tutti i suoi task?')) return;
  await API.deleteProject(id);
  allProjects = await API.projects();
  populateProjectFilters();
  renderProjects();
}

function openNewTask() {
  const projectOpts = allProjects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  const userOpts = allUsers.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
  openModal('Nuovo task', `
    <div class="form-grid">
      <div class="field-group"><label>Titolo *</label><input id="f-title" type="text" placeholder="Descrivi il task"/></div>
      <div class="field-group"><label>Descrizione</label><textarea id="f-desc" rows="2"></textarea></div>
      <div class="field-group"><label>Progetto</label><select id="f-project"><option value="">— Nessun progetto —</option>${projectOpts}</select></div>
      <div class="field-group"><label>Assegnato a</label><select id="f-assigned"><option value="">— Non assegnato —</option>${userOpts}</select></div>
      <div class="field-group"><label>Priorità</label>
        <select id="f-priority">
          <option value="low">Bassa</option>
          <option value="medium" selected>Media</option>
          <option value="high">Alta</option>
        </select>
      </div>
      <div class="field-group"><label>Scadenza</label><input id="f-due" type="date"/></div>
      <div class="field-group"><label>Stima (minuti)</label><input id="f-est" type="number" placeholder="60" min="0"/></div>
    </div>
    <button class="btn-primary" onclick="submitNewTask()">Crea task</button>
  `);
}

async function submitNewTask() {
  const title = $('f-title').value.trim();
  if (!title) return alert('Titolo obbligatorio');
  await API.createTask({
    title, description: $('f-desc').value,
    project_id: $('f-project').value || null,
    assigned_to: $('f-assigned').value || null,
    priority: $('f-priority').value,
    due_date: $('f-due').value || null,
    estimated_minutes: parseInt($('f-est').value) || 0,
  });
  await renderTasks();
  closeModal();
}

function openTaskDetail(id) {
  const t = allTasks.find(x => x.id === id);
  if (!t) return;
  const projectOpts = allProjects.map(p => `<option value="${p.id}" ${t.project_id == p.id ? 'selected' : ''}>${p.name}</option>`).join('');
  const userOpts = allUsers.map(u => `<option value="${u.id}" ${t.assigned_to == u.id ? 'selected' : ''}>${u.name}</option>`).join('');
  openModal(t.title, `
    <div class="task-detail">
      <div class="form-grid">
        <div class="field-group"><label>Titolo</label><input id="d-title" type="text" value="${t.title}"/></div>
        <div class="field-group"><label>Stato</label>
          <select id="d-status">
            <option value="todo" ${t.status === 'todo' ? 'selected' : ''}>Da fare</option>
            <option value="in_progress" ${t.status === 'in_progress' ? 'selected' : ''}>In corso</option>
            <option value="review" ${t.status === 'review' ? 'selected' : ''}>In revisione</option>
            <option value="done" ${t.status === 'done' ? 'selected' : ''}>Completato</option>
          </select>
        </div>
        <div class="field-group"><label>Priorità</label>
          <select id="d-priority">
            <option value="low" ${t.priority === 'low' ? 'selected' : ''}>Bassa</option>
            <option value="medium" ${t.priority === 'medium' ? 'selected' : ''}>Media</option>
            <option value="high" ${t.priority === 'high' ? 'selected' : ''}>Alta</option>
          </select>
        </div>
        <div class="field-group"><label>Progetto</label><select id="d-project"><option value="">— Nessuno —</option>${projectOpts}</select></div>
        <div class="field-group"><label>Assegnato a</label><select id="d-assigned"><option value="">— Nessuno —</option>${userOpts}</select></div>
        <div class="field-group"><label>Scadenza</label><input id="d-due" type="date" value="${t.due_date || ''}"/></div>
        <div class="field-group"><label>Stima (min)</label><input id="d-est" type="number" value="${t.estimated_minutes || 0}"/></div>
        <div class="field-group"><label>Registrati</label><span class="time-badge">⏱️ ${t.logged_minutes || 0} min</span></div>
      </div>
      <div class="task-detail-actions">
        <button class="btn-primary" onclick="submitEditTask(${id})">Salva</button>
        <button class="btn-ghost" onclick="openLogTime(${id})">+ Log tempo</button>
        <button class="btn-danger" onclick="deleteTask(${id})">Elimina</button>
      </div>
    </div>
  `);
}

async function submitEditTask(id) {
  const t = allTasks.find(x => x.id === id);
  await API.updateTask(id, {
    title: $('d-title').value,
    description: t.description,
    status: $('d-status').value,
    priority: $('d-priority').value,
    project_id: $('d-project').value || null,
    assigned_to: $('d-assigned').value || null,
    due_date: $('d-due').value || null,
    estimated_minutes: parseInt($('d-est').value) || 0,
    tags: JSON.parse(t.tags || '[]'),
    position: t.position || 0,
  });
  await renderTasks();
  closeModal();
}

function openLogTime(taskId) {
  openModal('Registra tempo', `
    <div class="form-grid">
      <div class="field-group"><label>Minuti lavorati</label><input id="log-min" type="number" min="1" placeholder="60"/></div>
      <div class="field-group"><label>Note (opzionale)</label><input id="log-note" type="text" placeholder="Es. Fix bug login"/></div>
    </div>
    <button class="btn-primary" onclick="submitLogTime(${taskId})">Registra</button>
  `);
}

async function submitLogTime(taskId) {
  const min = parseInt($('log-min').value);
  if (!min || min < 1) return alert('Inserisci i minuti');
  await API.logTime(taskId, min, $('log-note').value);
  closeModal();
}

async function deleteTask(id) {
  if (!confirm('Eliminare questo task?')) return;
  await API.deleteTask(id);
  await renderTasks();
  closeModal();
}

document.addEventListener('DOMContentLoaded', () => {
  init();

  $('hamburger-btn').addEventListener('click', () => {
    $('nav-links').classList.toggle('open');
  });

  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const which = tab.dataset.tab;
      $('login-form').classList.toggle('hidden', which !== 'login');
      $('register-form').classList.toggle('hidden', which !== 'register');
      hide($('auth-error'));
    });
  });

  $('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const { token, user } = await API.login($('login-email').value, $('login-password').value);
      localStorage.setItem('tf_token', token);
      currentUser = user;
      await showApp();
    } catch (err) {
      $('auth-error').textContent = err.message;
      show($('auth-error'));
    }
  });

  $('register-form').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const { token, user } = await API.register($('reg-name').value, $('reg-email').value, $('reg-password').value);
      localStorage.setItem('tf_token', token);
      currentUser = user;
      await showApp();
    } catch (err) {
      $('auth-error').textContent = err.message;
      show($('auth-error'));
    }
  });

  $('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('tf_token');
    currentUser = null;
    showAuth();
  });

  $('modal-close').addEventListener('click', closeModal);
  $('modal-overlay').addEventListener('click', e => { if (e.target === $('modal-overlay')) closeModal(); });

  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      $('nav-links').classList.remove('open');
      navigateTo(link.dataset.page);
    });
  });

  $('new-project-btn')?.addEventListener('click', openNewProject);
  $('new-task-btn')?.addEventListener('click', openNewTask);
  $('filter-project')?.addEventListener('change', renderTasks);
  $('filter-status')?.addEventListener('change', renderTasks);
  $('kanban-project-filter')?.addEventListener('change', renderKanban);
});