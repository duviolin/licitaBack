import "./config/load-env.js";
import app from "./app.js";
import env from "./config/env.js";

app.listen(env.PORT, () => {
  console.log(`Servidor rodando em http://localhost:${env.PORT}`);
});
