import * as authService from './auth.service.js';

export async function register(req, res) {
  const user = await authService.registerStudent(req.body);
  res.status(201).json({ user: user });
}

export async function login(req, res) {
  const result = await authService.logIn(req.body);
  res.json(result);
}

export function me(req, res) {
  res.json({ user: req.user });
}

export async function logout(req, res) {
  await authService.logOut(req.sessionId);
  res.status(204).end();
}
