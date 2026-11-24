import { useEffect, useState } from 'react';
import { apiRequest } from '../../api/api.js';

export default function FollowCategories({ onChanged, onError }) {
  const [categories, setCategories] = useState([]);

  async function loadCategories() {
    try {
      const data = await apiRequest('/student/categories');
      setCategories(data.categories);
    } catch (error) {
      onError(error.message);
    }
  }

  useEffect(function () {
    loadCategories();
  }, []);

  async function handleToggle(category) {
    let method = 'POST';
    if (category.isFollowed) {
      method = 'DELETE';
    }
    try {
      await apiRequest('/student/categories/' + category.id + '/follow', { method: method });
      await loadCategories();
      onChanged();
    } catch (error) {
      onError(error.message);
    }
  }

  return (
    <div className="follow-list">
      {categories.map(function (category) {
        let className = 'button-secondary';
        let label = 'Follow ' + category.name;
        if (category.isFollowed) {
          className = 'button';
          label = 'Following ' + category.name;
        }
        return (
          <button key={category.id} type="button" className={className} onClick={() => handleToggle(category)}>
            {label}
          </button>
        );
      })}
    </div>
  );
}
