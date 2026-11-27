import { useEffect, useState } from 'react';
import { apiRequest } from '../../api/api.js';
import { replaceById } from '../../utils/lists.js';

export default function FollowCategories({ onChanged, onError }) {
  const [categories, setCategories] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(function () {
    async function loadCategories() {
      try {
        const data = await apiRequest('/student/categories');
        setCategories(data.categories);
      } catch (error) {
        setLoadError(error.message);
      }
    }
    loadCategories();
  }, []);

  async function handleToggle(category) {
    let method = 'POST';
    if (category.isFollowed) {
      method = 'DELETE';
    }
    setBusyId(category.id);
    try {
      await apiRequest('/student/categories/' + category.id + '/follow', { method: method });
      setCategories(function (current) {
        return replaceById(current, { id: category.id, isFollowed: !category.isFollowed });
      });
      onChanged();
    } catch (error) {
      onError(error.message);
    }
    setBusyId(null);
  }

  if (loadError) {
    return <p className="muted small">{loadError}</p>;
  }

  return (
    <div className="chip-list">
      {categories.map(function (category) {
        return (
          <button
            key={category.id}
            type="button"
            className={category.isFollowed ? 'chip chip-on' : 'chip'}
            disabled={busyId === category.id}
            onClick={() => handleToggle(category)}
          >
            {category.isFollowed ? '✓ ' + category.name : '+ ' + category.name}
          </button>
        );
      })}
    </div>
  );
}
