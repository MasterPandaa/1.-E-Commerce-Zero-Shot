function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.user) return next();
  req.session.returnTo = req.originalUrl;
  return res.redirect("/login");
}

function ensureGuest(req, res, next) {
  if (req.session && req.session.user) return res.redirect("/");
  return next();
}

function ensureAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === "admin") {
    return next();
  }
  return res.status(403).send("Forbidden");
}

module.exports = { ensureAuthenticated, ensureGuest, ensureAdmin };
