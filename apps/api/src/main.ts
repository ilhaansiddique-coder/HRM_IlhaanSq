import "reflect-metadata";

import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configuredOrigins = (process.env.API_CORS_ORIGIN ?? "http://localhost:3000,http://127.0.0.1:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const isLanDevOrigin = (origin: string) => /^http:\/\/192\.168\.\d+\.\d+:3000$/i.test(origin);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (configuredOrigins.includes(origin) || isLanDevOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin not allowed by CORS: ${origin}`), false);
    },
    credentials: true,
  });
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidUnknownValues: false,
    }),
  );

  const port = Number(process.env.PORT ?? 3001);
  const host = process.env.HOST ?? "0.0.0.0";
  await app.listen(port, host);

  const displayHost = host === "0.0.0.0" ? "localhost" : host;
  Logger.log(`API listening on http://${displayHost}:${port}/api`, "Bootstrap");
}

bootstrap().catch((error) => {
  const message = error instanceof Error ? error.message : "Bootstrap failed";
  const stack = error instanceof Error ? error.stack ?? "" : "";
  Logger.error(message, stack, "Bootstrap");
  // Ensure startup failures are visible in non-nest log consumers.
  console.error("[Bootstrap] Fatal startup error:", error);
  process.exit(1);
});
