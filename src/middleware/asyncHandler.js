// Envuelve un handler async de Express: si lanza un error, lo pasa a next(err)
// en vez de convertirse en una promesa rechazada sin atender (lo cual, en Node
// moderno, termina el proceso completo). Úsalo en TODAS las rutas async.
module.exports = function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
