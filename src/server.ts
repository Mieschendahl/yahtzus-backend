import { createServer } from "node:http";
import { Server, Socket } from "socket.io";
import { ClientData, ClientToServerEvents, ServerToClientEvents } from "./shared/socket-types";
import { system } from "./system";

const stage = process.env.STAGE ?? "local";

const config = {
  local: {
    origin: "http://localhost:3010",
  },
  test: {
    origin: "https://test.yahtzus.goolagoon.org"
  },
  prod: {
    origin: "https://yahtzus.goolagoon.org",
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
  socket.on("disconnect", () => {
    // console.log("left")
    system.onClientData(socket, {
      kind: "leave room"
    });
  });

  socket.on("send", (clientData: ClientData) => {
    console.log("reached... socket", clientData)
    system.onClientData(socket, clientData);
  });
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});