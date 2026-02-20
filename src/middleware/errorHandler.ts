import { Request, Response, NextFunction } from "express";
import { Prisma } from "../generated/prisma/client.js";
import { env } from "../config/env.js";

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  let status = 500;
  let message = err.message || "Erro interno do servidor";

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002":
        status = 409;
        message = "Registro já existe (violação de unicidade)";
        break;
      case "P2003":
        status = 400;
        message = "Referência inválida (chave estrangeira)";
        break;
      case "P2025":
        status = 404;
        message = "Registro não encontrado";
        break;
    }
  } else {
    const msg = message.toLowerCase();
    if (msg.includes("não encontrad")) {
      status = 404;
    } else if (msg.includes("já cadastrad") || msg.includes("já registrad")) {
      status = 409;
    } else if (msg.includes("inválido") || msg.includes("obrigatório") || msg.includes("obrigatorio")) {
      status = 400;
    } else if (msg.includes("erro ao consultar")) {
      status = 502;
    }
  }

  const body: Record<string, unknown> = { error: message };
  if (env.NODE_ENV === "development") {
    body.stack = err.stack;
  }

  res.status(status).json(body);
}
