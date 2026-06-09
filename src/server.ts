import { createServer } from "node:http";
import { Server, Socket } from "socket.io";
import { ClientData, ClientToServerEvents, ServerCb, ServerToClientEvents } from "./shared/socket-types";

const stage = process.env.STAGE ?? "local";

const config = {
  local: {
    origin: "http://localhost:3010",
  },
  test: {
    origin: "https://test.dominoes.goolagoon.org"
  },
  prod: {
    origin: "https://dominoes.goolagoon.org",
  },
}[stage]!;

const server = createServer();
const port = 4010;

export const io = new Server<ClientToServerEvents, ServerToClientEvents>(
  server,
  {
    path: "/api",
    cors: {
      origin: [config.origin],
    },
    connectionStateRecovery: {},
    pingTimeout: 20000,
    pingInterval: 25000,
  }
);

export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

io.on("connection", (socket: AppSocket) => {
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});