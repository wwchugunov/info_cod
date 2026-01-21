const roleRank = {
  viewer: 1,
  manager: 2,
  admin: 3,
  superadmin: 4,
};

function hasRole(userRole, required) {
  if (!required || required.length === 0) return true;
  return required.includes(userRole);
}

export { roleRank, hasRole };
