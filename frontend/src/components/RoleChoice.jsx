export default function RoleChoice({ roles, value, onChange }) {
  return (
    <div className="role-choice">
      {roles.map(function (role) {
        return (
          <label key={role.value} className={value === role.value ? 'role-option role-option-on' : 'role-option'}>
            <input
              type="radio"
              name="role"
              value={role.value}
              checked={value === role.value}
              onChange={() => onChange(role.value)}
            />
            <strong>{role.label}</strong>
            {role.hint ? <span>{role.hint}</span> : null}
          </label>
        );
      })}
    </div>
  );
}
