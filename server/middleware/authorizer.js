// Middleware / Helper: authorizer.js
// Purpose: Implements strict central authorization verification functions for circle isolation and role-based access control.

function getCircleMembership(user, targetCircleId) {
  if (!user || !targetCircleId) return null;
  if (String(user.circle_id) === String(targetCircleId)) {
    return { circle_id: user.circle_id, role: user.role || 'Caregiver', status: 'active' };
  }
  if (Array.isArray(user.circle_memberships)) {
    const found = user.circle_memberships.find(m => String(m.circle_id) === String(targetCircleId) && m.status === 'active');
    if (found) return found;
  }
  return null;
}

function assertCircleMember(req, circleId) {
  const membership = getCircleMembership(req.user, circleId);
  if (!membership) {
    const error = new Error('Unauthorized: You are not an active member of this circle');
    error.status = 403;
    throw error;
  }
  return membership;
}

function assertCircleRole(req, circleId, allowedRoles) {
  const membership = assertCircleMember(req, circleId);
  if (!allowedRoles.includes(membership.role)) {
    const error = new Error(`Unauthorized: Requires one of the following roles: ${allowedRoles.join(', ')}`);
    error.status = 403;
    throw error;
  }
  return membership;
}

function assertStoragePathInCircle(circleId, filePath) {
  if (!filePath || !filePath.startsWith(`${circleId}/`)) {
    const error = new Error('Unauthorized: Storage path does not belong to the target circle');
    error.status = 403;
    throw error;
  }
  return true;
}

module.exports = {
  getCircleMembership,
  assertCircleMember,
  assertCircleRole,
  assertStoragePathInCircle
};
