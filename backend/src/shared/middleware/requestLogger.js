const SKIPPED_PATHS = ['/api/health'];

function pathWithoutQuery(req) {
  return req.originalUrl.split('?')[0];
}

export function requestLogger(req, res, next) {
  const path = pathWithoutQuery(req);
  if (SKIPPED_PATHS.includes(path)) {
    next();
    return;
  }

  const startedAt = Date.now();
  res.on('finish', function () {
    let userId = null;
    if (req.user) {
      userId = req.user.id;
    }
    const line = {
      type: 'request',
      method: req.method,
      path: path,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
      userId: userId,
    };
    console.log(JSON.stringify(line));
  });
  next();
}
