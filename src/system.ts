import { AppSocket, io } from "./server";
import { ClientData, GameIO, isFieldId, StateIO } from "./shared/socket-types";
import { random } from "./utils";
import { Dice, Player } from "./models";

class Game {
  constructor(
    public players: Player[] = [],
    public dices: Dice[] = Dice.createDice(),
    public activePlayerId?: number,
    public rollCount?: number,
    public state: StateIO = { kind: "lobby" }
  ) {}

  getPlayer(userId: string): Player | undefined {
    return this.players.find(player => player.userId === userId);
  }

  getActivePlayer(userId: string): Player | undefined {
    if (this.activePlayerId === undefined)
      return undefined;
    const player = this.players[this.activePlayerId];
    if (player.userId !== userId)
      return undefined;
    return player;
  }

  joinPlayers(userId: string) {
    // console.log("join", userId, this.players)
    if (this.getPlayer(userId))
      return;

    this.players.push(new Player(userId));
    this.sendAll();
  }

  leavePlayers(userId: string) {
    // console.log("leave", userId, this.players)
    if (!this.getPlayer(userId))
      return;

    this.players = this.players.filter(player => player.userId !== userId);
    this.sendAll();
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
    this.activePlayerId = 0;
    this.rollCount = 0;
    this.sendAll();
  }

  rollDices(userId: string) {
    // console.log("reached moi", this.state.kind !== "playing", !this.getActivePlayer(userId), this.rollCount! >= 3, this.activePlayerId, this.players)
    if (this.state.kind !== "playing")
      return;
    if (!this.getActivePlayer(userId))
      return;
    if (this.rollCount! >= 3)
      return;
    const player = this.getActivePlayer(userId)!;

    this.rollCount!++;
    this.dices.forEach(dice => {
      if (dice.selected) {
        dice.roll();
      }
    });
    Object.keys(player.fields).forEach(fieldId => {
      const fieldData = player.fields[fieldId];
      if (fieldData.value === undefined) {
        player.fields[fieldId] = {
          value: player.getFieldValue(fieldId),
          isPreview: true
        };
      }
    })
    this.sendAll();
  }

  selectDice(userId: string, selected: boolean[]) {
    if (this.state.kind !== "playing")
      return;
    if (!this.getActivePlayer(userId))
      return;
    if (this.rollCount! >= 3)
      return;
    if (selected.length !== 5)
      return;
  
    selected.forEach((selected_, i) => this.dices[i].selected = selected_);
    this.sendAll();
  }

  getValue(fieldId: string): number {
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
    throw "impossible";
  }

  selectField(userId: string, fieldId: string) {
    if (this.state.kind !== "playing")
      return;
    if (!this.getActivePlayer(userId))
      return;
    if (this.rollCount! === 0)
      return;
    if (!isFieldId(fieldId))
      return;
    const player = this.getActivePlayer(userId)!;
    if (player.getFieldValue(fieldId) !== undefined)
      return;
    
    player.fields[fieldId] = {
      value: this.getValue(fieldId),
      isPreview: false
    };
    Object.keys(player.fields).forEach(fieldId => {
      const fieldData = player.fields[fieldId];
      if (fieldData.isPreview) {
        player.fields[fieldId] = {
          value: undefined,
          isPreview: false
        };
      }
    })
    this.dices.forEach(dice => dice.selected = true);
    this.sendAll();
  }

  sendAll(socket?: AppSocket) {
    if (socket) {
      socket.emit("send", {
        kind: "set game",
        data: {
          game: this.toIO()
        }
      });
    } else {
      io.to("room").emit("send", {
        kind: "set game",
        data: {
          game: this.toIO()
        }
      });
    }
  }

  toIO(): GameIO {
    return {
      players: this.players.map(player => player.toIO()),
      dices: this.dices.map(dice => dice.toIO()),
      activePlayerId: this.activePlayerId,
      rollCount: this.rollCount,
      state: this.state
    };
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
    // console.log("reached... here", clientData)
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
        this.game.rollDices(userId);
        break;
      case "select dices":
        const {selected} = data;
        this.game.selectDice(userId, selected);
        break;
    }
  }

  joinRoom(socket: AppSocket, userId?: string) {
    userId = userId ?? "";
    userId = userId.trim()

    this.socketMap.set(socket, {userId});
    if (userId && !this.userIdMap.get(userId)?.socket) {
      this.userIdMap.set(userId, {socket});
    }

    socket.join("room");
    this.handleClientData(socket, {
      kind: "join players"
    });
    this.game.sendAll(socket);
  }

  leaveRoom(socket: AppSocket) {
    this.handleClientData(socket, {
      kind: "leave players"
    });
    const userId = this.getValidUserId(socket);
    this.socketMap.delete(socket);
    if (userId) {
      this.userIdMap.delete(userId);
    }
    socket.leave("room");
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
        this.handleClientData(socket, {
          kind: "leave room"
        });
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