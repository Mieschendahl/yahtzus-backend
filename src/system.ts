import { Socket } from "socket.io";
import { AppSocket } from "./server";
import { ClientData } from "./shared/socket-types";
import { random } from "./utils";

export const FIELD_ID = [
  "ones",
  "twos",
  "threes",
  "fours",
  "fives",
  "sixes",
] as const;

export type FieldId = typeof FIELD_ID[number];

export type Column = Partial<Record<FieldId, number>>;

function isFieldId(value: FieldId): boolean {
  return FIELD_ID.includes(value);
}

class Player {
  constructor(
    public userId: string,
    public column: Column = {}
  ) {}
}

type State = (
  | {
    kind: "lobby",
    data?: undefined
  }
  | {
    kind: "playing"
    data?: undefined
  }
);

class Dice {
  constructor(
    public num: number = 1,
    public selected: boolean = true
  ) {}

  roll() {
    this.num = random.integer(1, 6)
  }

  static createDice(): Dice[] {
    return Array.from({length: 5}, () => new Dice());
  }
}

class Game {
  constructor(
    public players: Player[] = [],
    public dices: Dice[] = Dice.createDice(),
    public activePlayerId?: number,
    public rollCount?: number,
    public state: State = { kind: "lobby" }
  ) {}

  getPlayer(userId: string): Player | undefined {
    return this.players.find(player => player.userId === userId);
  }

  getActivePlayer(userId: string): Player | undefined {
    if (!this.activePlayerId)
      return undefined;
    const player = this.players[this.activePlayerId];
    if (player.userId !== userId)
      return undefined;
    return player;
  }

  joinPlayers(userId: string) {
    if (this.getPlayer(userId))
      return;

    this.players.push(new Player(userId));
  }

  leavePlayers(userId: string) {
    if (!this.getPlayer(userId))
      return;

    this.players = this.players.filter(player => player.userId === userId);
  }

  startGame(userId: string) {
    if (this.state.kind !== "lobby")
      return;
    if (!this.getPlayer(userId))
      return;

    this.state = { kind: "playing"};
    this.players = this.players.map(player => new Player(player.userId));
    this.players = random.shuffle(this.players);
    this.dices = Dice.createDice();
    this.activePlayerId = 1;
    this.rollCount = 0;
  }

  rollDice(userId: string) {
    if (this.state.kind !== "lobby")
      return;
    if (!this.getActivePlayer(userId))
      return;
    
    this.dices.forEach(dice => dice.roll());
  }

  selectDice(userId: string, selected: boolean[]) {
    if (this.state.kind !== "lobby")
      return;
    if (!this.getActivePlayer(userId))
      return;
    if (this.rollCount! >= 3)
      return;
    if (selected.length !== 5)
      return;
  
    selected.forEach((selected_, i) => this.dices[i].selected = selected_)
  }

  private getValue(fieldId: FieldId): number {
    const counts = Array.from({length: 6}, () => 0);
    this.dices.forEach(dice => counts[dice.num]++);
    switch (fieldId) {
      case "ones":
        return counts[1] * 1;
      case "twos":
        return counts[2] * 2;
      case "threes":
        return counts[3] * 3;
      case "fours":
        return counts[4] * 4;
      case "fives":
        return counts[5] * 5;
      case "sixes":
        return counts[6] * 6;
    }
  }

  selectField(userId: string, fieldId: FieldId) {
    if (this.state.kind !== "lobby")
      return;
    if (!this.getActivePlayer(userId))
      return;
    if (this.rollCount! === 0)
      return;
    if (!isFieldId(fieldId))
      return;
    
    const player = this.getActivePlayer(userId);
    player!.column[fieldId] = this.getValue(fieldId);
  }
}

type RoomSocketData = {
  userId?: string;
};

type RoomUserIdData = {
  socket?: AppSocket;
};

class Room {
  constructor(
    public socketMap: Map<AppSocket, RoomSocketData> = new Map(),
    public userIdMap: Map<string, RoomUserIdData> = new Map(),
    public game: Game = new Game()
  ) {}

  getValidUserId(socket: AppSocket): string | undefined {
    const userId = this.socketMap.get(socket)?.userId;
    if (!userId)
      return undefined;
    if (this.userIdMap.get(userId)?.socket !== socket) {
      return undefined;
    }
    return userId;
  }

  getUserIdData(validUserId: string): RoomUserIdData {
    const userIdData = this.userIdMap.get(validUserId);
    if (!userIdData)
      throw "Invalid userId";
    return userIdData;
  }

  handleClientData(socket: AppSocket, clientData: ClientData) {
    const {kind, data} = clientData;
    const userId = this.getValidUserId(socket);
    if (!userId)
      return;
    switch (kind) {
      case "join players":
        this.game.joinPlayers(userId);
        break;
      case "leave players":
        this.game.leavePlayers(userId);
        break;
      case "start game":
        this.game.startGame(userId);
        break;
      case "roll dices":
        this.game.startGame(userId);
        break;
      case "select dices":
        this.game.startGame(userId);
        break;
    }
  }

  joinRoom(socket: AppSocket, userId?: string) {
    userId = userId ?? "";
    userId = userId.trim()
    if (userId) {
      if (!this.userIdMap.get(userId)?.socket) {
        this.socketMap.set(socket, {userId});
        this.userIdMap.set(userId, {socket});
      } else {
        this.socketMap.set(socket, {});
      }
    }
  }

  leaveRoom(socket: AppSocket) {
    this.socketMap.delete(socket);
    const userId = this.getValidUserId(socket);
    if (userId) {
      this.userIdMap.delete(userId);
    }
  }

  sendAll(socket: AppSocket) {

  }
}

class System {
  constructor(
    public room = new Room()
  ) { }

  handleClientData(socket: AppSocket, clientData: ClientData) {
    const {kind, data} = clientData;
    switch (kind) {
      case "join room":
        const { userId } = data;
        this.room.leaveRoom(socket);
        this.room.joinRoom(socket, userId);
        break;
      case "leave room":
        this.room.leaveRoom(socket);
        break;
      default:
        this.room.handleClientData(socket, clientData);
    }
  }
}

export const system = new System();