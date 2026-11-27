import { useEffect, useState } from 'react';
import { apiRequest } from '../../api/api.js';
import Message from '../../components/Message.jsx';
import { replaceById } from '../../utils/lists.js';

function RenameForm({ category, busy, onSave, onBack }) {
  const [name, setName] = useState(category.name);

  function handleSubmit(formEvent) {
    formEvent.preventDefault();
    onSave(name);
  }

  return (
    <form className="row grow" onSubmit={handleSubmit}>
      <input className="grow" value={name} onChange={(inputEvent) => setName(inputEvent.target.value)} required minLength={2} maxLength={50} />
      <button type="submit" className="button-small" disabled={busy}>Save</button>
      <button type="button" className="button-secondary button-small" onClick={onBack}>Back</button>
    </form>
  );
}

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [newName, setNewName] = useState('');
  const [message, setMessage] = useState({ type: 'info', text: '' });

  useEffect(function () {
    async function loadCategories() {
      try {
        const data = await apiRequest('/admin/categories');
        setCategories(data.categories);
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      }
      setLoading(false);
    }
    loadCategories();
  }, []);

  async function runAction(busyMark, action, successText) {
    setBusyId(busyMark);
    setMessage({ type: 'info', text: '' });
    let worked = true;
    try {
      await action();
      setMessage({ type: 'success', text: successText });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
      worked = false;
    }
    setBusyId(null);
    return worked;
  }

  async function handleAdd(formEvent) {
    formEvent.preventDefault();
    const added = await runAction('new', async function () {
      const data = await apiRequest('/admin/categories', { method: 'POST', body: { name: newName } });
      setCategories(function (current) {
        return [...current, { ...data.category, _count: { events: 0 } }];
      });
    }, 'Added "' + newName + '"');
    if (added) {
      setNewName('');
    }
  }

  async function handleRename(category, name) {
    const renamed = await runAction(category.id, async function () {
      const data = await apiRequest('/admin/categories/' + category.id, { method: 'PATCH', body: { name: name } });
      setCategories(function (current) {
        return replaceById(current, data.category);
      });
    }, 'Renamed to "' + name + '"');
    if (renamed) {
      setEditingId(null);
    }
  }

  function handleToggle(category) {
    let successText = 'Turned on "' + category.name + '"';
    if (category.isActive) {
      successText = 'Turned off "' + category.name + '". Organizers no longer see it.';
    }
    runAction(category.id, async function () {
      const data = await apiRequest('/admin/categories/' + category.id, { method: 'PATCH', body: { isActive: !category.isActive } });
      setCategories(function (current) {
        return replaceById(current, data.category);
      });
    }, successText);
  }

  return (
    <section>
      <div className="page-title-row">
        <div>
          <h1>Categories</h1>
          <p className="page-intro">Organizers choose from the categories that are on.</p>
        </div>
      </div>
      <Message type={message.type} text={message.text} />

      <form className="card row" onSubmit={handleAdd}>
        <input
          className="grow"
          placeholder="New category name"
          value={newName}
          onChange={(inputEvent) => setNewName(inputEvent.target.value)}
          required
          minLength={2}
          maxLength={50}
        />
        <button type="submit" disabled={busyId === 'new'}>Add category</button>
      </form>

      <h2>All categories</h2>
      {loading ? <p className="muted">Loading...</p> : null}
      {categories.length > 0 ? (
        <ul className="plain-list">
          {categories.map(function (category) {
            return (
              <li key={category.id}>
                {editingId === category.id ? (
                  <RenameForm
                    category={category}
                    busy={busyId === category.id}
                    onSave={(name) => handleRename(category, name)}
                    onBack={() => setEditingId(null)}
                  />
                ) : (
                  <>
                    <div className="row">
                      <strong>{category.name}</strong>
                      <span className={category.isActive ? 'badge badge-approved' : 'badge badge-completed'}>
                        {category.isActive ? 'On' : 'Off'}
                      </span>
                      <span className="muted small">{category._count.events} events</span>
                    </div>
                    <div className="row">
                      <button type="button" className="button-secondary button-small" onClick={() => setEditingId(category.id)}>
                        Rename
                      </button>
                      <button type="button" className="button-secondary button-small" disabled={busyId === category.id} onClick={() => handleToggle(category)}>
                        {category.isActive ? 'Turn off' : 'Turn on'}
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
