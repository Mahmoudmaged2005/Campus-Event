import { useEffect, useState } from 'react';
import { apiRequest } from '../../api/api.js';
import Message from '../../components/Message.jsx';
import AdminNav from './AdminNav.jsx';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: 'info', text: '' });
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  async function loadCategories() {
    try {
      const data = await apiRequest('/admin/categories');
      setCategories(data.categories);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
    setLoading(false);
  }

  useEffect(function () {
    loadCategories();
  }, []);

  async function runAction(action, successText) {
    setMessage({ type: 'info', text: 'Working...' });
    try {
      await action();
      setMessage({ type: 'success', text: successText });
      await loadCategories();
      return true;
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
      return false;
    }
  }

  async function handleAdd(formEvent) {
    formEvent.preventDefault();
    const added = await runAction(function () {
      return apiRequest('/admin/categories', { method: 'POST', body: { name: newName } });
    }, 'Added "' + newName + '"');
    if (added) {
      setNewName('');
    }
  }

  function startRename(category) {
    setEditingId(category.id);
    setEditName(category.name);
  }

  async function handleRename(formEvent, category) {
    formEvent.preventDefault();
    const renamed = await runAction(function () {
      return apiRequest('/admin/categories/' + category.id, { method: 'PATCH', body: { name: editName } });
    }, 'Renamed to "' + editName + '"');
    if (renamed) {
      setEditingId(null);
    }
  }

  function handleToggle(category) {
    let successText = 'Turned on "' + category.name + '"';
    if (category.isActive) {
      successText = 'Turned off "' + category.name + '". Organizers no longer see it.';
    }
    runAction(function () {
      return apiRequest('/admin/categories/' + category.id, { method: 'PATCH', body: { isActive: !category.isActive } });
    }, successText);
  }

  return (
    <section>
      <AdminNav />
      <h1>Categories</h1>
      <Message type={message.type} text={message.text} />
      <div className="card">
        <form className="form" onSubmit={handleAdd}>
          <label>
            New category name
            <input value={newName} onChange={(inputEvent) => setNewName(inputEvent.target.value)} required />
          </label>
          <div className="event-actions">
            <button type="submit" className="button">Add category</button>
          </div>
        </form>
      </div>
      {loading ? <p>Loading...</p> : null}
      <div className="event-list">
        {categories.map(function (category) {
          return (
            <article key={category.id} className="card">
              {editingId === category.id ? (
                <form className="form" onSubmit={(formEvent) => handleRename(formEvent, category)}>
                  <label>
                    New name
                    <input value={editName} onChange={(inputEvent) => setEditName(inputEvent.target.value)} required />
                  </label>
                  <div className="event-actions">
                    <button type="submit" className="button">Save name</button>
                    <button type="button" className="button-secondary" onClick={() => setEditingId(null)}>Back</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="event-title-row">
                    <h3>{category.name}</h3>
                    <span className={category.isActive ? 'badge badge-approved' : 'badge badge-cancelled'}>
                      {category.isActive ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <p className="event-where">Used by {category._count.events} events</p>
                  <div className="event-actions">
                    <button type="button" className="button-secondary" onClick={() => startRename(category)}>
                      Rename
                    </button>
                    <button type="button" className="button-secondary" onClick={() => handleToggle(category)}>
                      {category.isActive ? 'Turn off' : 'Turn on'}
                    </button>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
