import jwt from 'jsonwebtoken';

function readToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

function verifyToken(token) {
  const secret = process.env.JWT_SECRET || 'dev_secret';
  return jwt.verify(token, secret);
}

export function signAdminToken(payload) {
  const secret = process.env.JWT_SECRET || 'dev_secret';
  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

export function requireAdmin(req, res, next) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ message: 'Missing token' });

  try {
    const decoded = verifyToken(token);
    req.admin = decoded;
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

export function requirePermission(permission) {
  return (req, res, next) => {
    const token = readToken(req);
    if (!token) return res.status(401).json({ message: 'Missing token' });

    try {
      const decoded = verifyToken(token);
      req.admin = decoded;
      if (decoded?.isSuperAdmin) return next();
      const perms = Array.isArray(decoded?.permissions) ? decoded.permissions : [];
      if (perms.includes(permission)) return next();
      return res.status(403).json({ message: 'Forbidden' });
    } catch {
      return res.status(401).json({ message: 'Invalid token' });
    }
  };
}
