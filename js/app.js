(() => {
  const items = [...document.querySelectorAll('.item')];
  const counter = document.querySelector('#count');
  const visible = document.querySelector('#visible');
  const filterButtons = [...document.querySelectorAll('.filters button')];
  const authPanel = document.querySelector('#auth-panel');
  const authForm = document.querySelector('#auth-form');
  const emailInput = document.querySelector('#auth-email');
  const passwordInput = document.querySelector('#auth-password');
  const authSubmit = document.querySelector('#auth-submit');
  const authSwitch = document.querySelector('#auth-switch');
  const logoutButton = document.querySelector('#auth-logout');
  const authMessage = document.querySelector('#auth-message');
  const syncStatus = document.querySelector('#sync-status');
  const storageKey = 'doomlist-watched-v1';
  let filter = 'all';
  let isSignup = false;
  let supabase = null;
  let currentUser = null;
  let watched = loadLocal();

  function loadLocal() {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); }
    catch { return {}; }
  }
  function saveLocal() {
    try { localStorage.setItem(storageKey, JSON.stringify(watched)); } catch {}
  }
  function setMessage(message, error = false) {
    if (!authMessage) return;
    authMessage.textContent = message;
    authMessage.classList.toggle('error', error);
  }
  function setSyncStatus(message, online = false) {
    if (!syncStatus) return;
    syncStatus.querySelector('span').textContent = message;
    syncStatus.classList.toggle('online', online);
  }
  function watchedCount() {
    return items.filter(item => watched[item.dataset.id || item.querySelector('.num')?.textContent.trim()]).length;
  }
  function updateProgressMessage() {
    if (currentUser) {
      setSyncStatus('CLOUD SYNC ACTIVE', true);
      setMessage('SIGNED IN: ' + currentUser.email + ' · ' + watchedCount() + '/' + items.length + ' WATCHED');
    } else if (!supabase) {
      setSyncStatus('SYNC NOT CONFIGURED');
      setMessage('Cloud sync is not connected yet. Local checkboxes still work on this device.');
    } else {
      setSyncStatus('NOT SIGNED IN');
      setMessage('Sign in or create an account to sync your list across devices.');
    }
  }
  function render(nextFilter = filter) {
    filter = nextFilter;
    let count = 0;
    items.forEach(item => {
      const show = filter === 'all' || item.dataset.type === filter;
      count += show ? 1 : 0;
      item.classList.toggle('hidden', !show);
      const id = item.dataset.id || item.querySelector('.num')?.textContent.trim();
      const checkbox = item.querySelector('.watched-toggle input');
      if (checkbox) checkbox.checked = Boolean(watched[id]);
      item.classList.toggle('is-watched', Boolean(watched[id]));
    });
    if (counter) counter.textContent = String(count).padStart(2, '0');
    if (visible) visible.textContent = watchedCount() + ' / ' + items.length + ' WATCHED';
    updateProgressMessage();
  }
  async function syncItem(id, value) {
    if (!supabase || !currentUser) return;
    const { error } = await supabase.from('watch_progress').upsert({
      user_id: currentUser.id, item_id: id, watched: value, updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,item_id' });
    if (error) {
      setMessage('Saved on this device, but cloud sync failed: ' + error.message, true);
      setSyncStatus('SYNC ERROR');
    } else {
      setMessage('SYNCED · ' + watchedCount() + '/' + items.length + ' WATCHED');
    }
  }
  async function loadCloudProgress() {
    if (!supabase || !currentUser) return;
    setSyncStatus('SYNCING…');
    const { data, error } = await supabase.from('watch_progress').select('item_id, watched');
    if (error) {
      setMessage('Could not load cloud progress. Check that the database schema is installed.', true);
      setSyncStatus('SYNC ERROR');
      return;
    }
    const cloud = {};
    (data || []).forEach(row => { cloud[row.item_id] = row.watched; });
    watched = { ...watched, ...cloud };
    saveLocal();
    render();
    setSyncStatus('CLOUD SYNC ACTIVE', true);
    setMessage('SYNCED · ' + watchedCount() + '/' + items.length + ' WATCHED');
  }
  items.forEach(item => {
    const num = item.querySelector('.num')?.textContent.trim();
    if (!num) return;
    item.dataset.id = num;
    if (!item.querySelector('.watched-toggle')) {
      const label = document.createElement('label');
      label.className = 'watched-toggle';
      label.innerHTML = '<input type="checkbox" aria-label="Mark as watched"><span>WATCHED</span>';
      const priority = item.querySelector('.priority');
      item.insertBefore(label, priority || null);
      label.querySelector('input').addEventListener('change', async event => {
        const id = item.dataset.id;
        watched[id] = event.target.checked;
        saveLocal();
        render();
        await syncItem(id, event.target.checked);
      });
    }
  });
  filterButtons.forEach(button => button.addEventListener('click', () => {
    filterButtons.forEach(other => other.classList.remove('selected'));
    button.classList.add('selected');
    render(button.dataset.filter);
  }));

  if (authSwitch) authSwitch.addEventListener('click', () => {
    isSignup = !isSignup;
    authSubmit.innerHTML = isSignup ? 'CREATE ACCOUNT <b>→</b>' : 'SIGN IN <b>→</b>';
    authSwitch.textContent = isSignup ? 'ALREADY REGISTERED? SIGN IN' : 'NEED AN ACCOUNT? CREATE ONE';
    passwordInput.autocomplete = isSignup ? 'new-password' : 'current-password';
    setMessage(isSignup ? 'Create an account with your email and a password.' : 'Sign in to sync your watch progress.');
  });
  if (logoutButton) logoutButton.addEventListener('click', async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setMessage(error.message, true);
  });
  if (authForm) authForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!supabase) {
      setMessage('Supabase is not configured yet. The account system will activate after project setup.', true);
      return;
    }
    authSubmit.disabled = true;
    try {
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      const result = isSignup
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (isSignup && !result.data.session) {
        setMessage('Account created. Check your email to confirm it, then sign in.');
      } else {
        setMessage(isSignup ? 'Account created. Loading your progress…' : 'Signed in. Loading your progress…');
      }
    } catch (error) {
      setMessage(error.message || 'Authentication failed.', true);
    } finally {
      authSubmit.disabled = false;
    }
  });

  if (window.DOOMLIST_SUPABASE_URL && window.DOOMLIST_SUPABASE_KEY &&
      window.supabase && window.supabase.createClient) {
    supabase = window.supabase.createClient(window.DOOMLIST_SUPABASE_URL, window.DOOMLIST_SUPABASE_KEY);
    supabase.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user || null;
      if (logoutButton) logoutButton.classList.toggle('hidden', !currentUser);
      if (authSubmit) authSubmit.classList.toggle('hidden', Boolean(currentUser));
      if (authSwitch) authSwitch.classList.toggle('hidden', Boolean(currentUser));
      if (emailInput) emailInput.classList.toggle('hidden', Boolean(currentUser));
      if (passwordInput) passwordInput.classList.toggle('hidden', Boolean(currentUser));
      if (authForm) authForm.querySelectorAll('label').forEach(label => label.classList.toggle('hidden', Boolean(currentUser)));
      if (currentUser) loadCloudProgress();
      else updateProgressMessage();
    });
  } else {
    setSyncStatus('SYNC NOT CONFIGURED');
    setMessage('Local mode active. Add the Supabase project URL and publishable key to enable accounts and cloud sync.');
  }
  render();
})();
