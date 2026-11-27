import * as authService from './auth.service.js';

export async function register(req, res) {
  const result = await authService.registerUser(req.body);
  res.status(201).json(result);
}

export async function verifyEmail(req, res) {
  const result = await authService.verifyEmail(req.body);
  res.json(result);
}

export async function resendCode(req, res) {
  const result = await authService.resendCode(req.body);
  res.json(result);
}

export async function forgotPassword(req, res) {
  const result = await authService.forgotPassword(req.body);
  res.json(result);
}

export async function resetPassword(req, res) {
  const result = await authService.resetPassword(req.body);
  res.json(result);
}

export async function login(req, res) {
  const result = await authService.logIn(req.body);
  res.json(result);
}

export function me(req, res) {
  res.json({ user: req.user });
}

export async function updateMe(req, res) {
  const user = await authService.updateProfile(req.user.id, req.sessionId, req.body);
  res.json({ user: user });
}

export async function logout(req, res) {
  await authService.logOut(req.sessionId);
  res.status(204).end();
}
