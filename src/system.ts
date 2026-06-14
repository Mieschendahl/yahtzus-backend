import { AppSocket, io } from "./server";
import { ClientData, ClientDataCb, EFFECT_DATA, EFFECT_IDS, EffectData, FIELD_DATA, FIELD_IDS, FieldData, GameIO, getEffectIndex, getFieldIndex, StateIO } from "./shared/socket-types";
import { random } from "./utils";
import { sum } from "./utils";
import { DiceIO, PlayerIO } from "./shared/socket-types";

export class Player {
  constructor(
    public userId: string,
    public fields: FieldData[]
  ) { }

  setTotalValue() {
    this.fields[getFieldIndex("Total")].value = sum(
      this.fields
        .filter(({ isPrimitive }) => isPrimitive)
        .map(({ value }) => Number(value ?? 0))
    ).toString();
  }

  toIO(): PlayerIO {
    return {
      userId: this.userId,
      fields: this.fields
    };
  }

  static fromIO({ userId, fields: column }: PlayerIO): Player {
    return new Player(userId, column);
  }
}

export class Dice {
  constructor(
    public num: number = 1,
    public selected: boolean = true
  ) { }

  roll() {
    this.num = random.integer(1, 6)
  }

  toIO(): DiceIO {
    return {
      num: this.num,
      selected: this.selected
    };
  }

  static fromIO({ num, selected }: DiceIO): Dice {
    return new Dice(num, selected);
  }

  static createDice(): Dice[] {
    return Array.from({ length: 5 }, () => new Dice());
  }
}

class Game {
  public players: Player[] = [];
  public dices: Dice[] = Dice.createDice();
  public activePlayerId?: number;
  public rollCount?: number;
  public state: StateIO = { kind: "lobby" };
  public fieldIdToEffectId: Map<string, string | undefined> = new Map();
  public activeTurnEffectIds: Set<string> = new Set();
  public activeRollEffectIds: Set<string> = new Set();
  public multiplier: number = 1;

  constructor() {
    this.setEffects();
  }

  setEffects() {
    this.fieldIdToEffectId = new Map();
    FIELD_IDS.forEach(fieldId => {
      const field = FIELD_DATA[getFieldIndex(fieldId)];
      this.fieldIdToEffectId.set(fieldId, field.isPrimitive ? random.pick([undefined, random.pick(EFFECT_IDS)]) : undefined);
    });
  }

  getPlayer(userId: string): Player | undefined {
    return this.players.find(player => player.userId === userId);
  }

  getActivePlayer(userId?: string): Player | undefined {
    if (this.activePlayerId === undefined)
      return undefined;
    const player = this.players[this.activePlayerId];
    if (userId !== undefined && player.userId !== userId)
      return undefined;
    return player;
  }

  makePlayer(userId: string): Player {
    const fields: FieldData[] = FIELD_DATA.map(({ fieldId, isPrimitive }, index) => {
      return {
        fieldId,
        index,
        isPrimitive,
        isPreview: false,
        value: (() => {
          switch (fieldId) {
            case "User ID":
              return userId;
            default:
              return undefined;
          }
        })(),
        effect: {
          effectId: this.fieldIdToEffectId.get(fieldId),
          status: "locked"
        }
      };
    });
    return new Player(userId, fields);
  }

  startGame(userId: string) {
    if (this.state.kind !== "lobby")
      return;
    if (!this.getPlayer(userId))
      return;

    this.state = { kind: "playing" };
    this.setEffects();
    this.players = this.players.map(player => this.makePlayer(player.userId));
    this.players.forEach(player => player.setTotalValue());
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
    player.fields.forEach(field => {
      if (field.isPreview) {
        field.value = undefined;
        field.isPreview = false;
      }
    });
    this.setFieldPreviews(player.fields);
    // console.log(player.fields)
    // if (this.rollCount! >= 3) {
    //   this.dices.forEach(dice => dice.selected = true);
    // }
    // console.log("should have send", player.fields)
    this.clearEffects();
    this.sendAll();
  }

  selectDices(userId: string, selected: boolean[]) {
    if (this.state.kind !== "playing")
      return;
    if (!this.getActivePlayer(userId))
      return;
    if (this.rollCount! === 0)
      return;
    // if (this.rollCount! === 0 || this.rollCount! >= 3)
    //   return;
    this.dices.forEach((dice, i) => dice.selected = i < selected.length ? selected[i] : true);
    this.sendAll();
  }

  selectField(userId: string, fieldId: string) {
    if (this.state.kind !== "playing")
      return;
    if (!this.getActivePlayer(userId))
      return;
    if (this.rollCount! === 0)
      return;
    const fieldIndex = getFieldIndex(fieldId);
    if (fieldIndex < 0)
      return;
    const player = this.getActivePlayer(userId)!;
    const field = player.fields[fieldIndex];
    if (!field.isPreview)
      return;
    if (!field.isPrimitive)
      return;
    field.isPreview = false;
    if (field.effect.effectId !== undefined && Number(field.value) > 0) {
      field.effect.status = "unlocked";
    }
    player.setTotalValue();
    player.fields.forEach(field => {
      if (field.isPreview) {
        field.value = undefined;
        field.isPreview = false;
      }
    });
    this.dices.forEach(dice => {
      dice.num = 1;
      dice.selected = true;
    });
    this.rollCount = 0;
    this.activePlayerId = (this.activePlayerId! + 1) % this.players.length;
    this.clearEffects(true);
    this.sendAll();
  }

  clearEffects(turnEnd: boolean = false) {
    this.activeRollEffectIds.forEach(effectId => {
      if (effectId === "Double Value") {
        this.multiplier = 1;
      }
    });
    if (turnEnd) {
      this.activeTurnEffectIds.forEach(effectId => {

      });
    }
  }

  selectEffect(userId: string, fieldId: string) {
    if (this.state.kind !== "playing")
      return;
    if (!this.getActivePlayer(userId))
      return;
    if (this.rollCount! === 0)
      return;
    const fieldIndex = getFieldIndex(fieldId);
    if (fieldIndex < 0)
      return;
    const player = this.getActivePlayer(userId)!;
    const field = player.fields[fieldIndex];
    const effect = field.effect;
    if (effect.status !== "unlocked")
      return;
    if (effect.effectId === undefined || this.activeRollEffectIds.has(effect.effectId) || this.activeTurnEffectIds.has(effect.effectId))
      return;
    if (effect.effectId === "Double Value") {
      this.activeTurnEffectIds.add(effect.effectId);
      this.multiplier = 2;
    }
    effect.status = "in use";
    player.fields.forEach(field => {
      if (field.isPreview) {
        field.value = undefined;
        field.isPreview = false;
      }
    });
    this.setFieldPreviews(player.fields);
    player.setTotalValue();
    this.sendAll();
  }

  setFieldPreviews(fields: FieldData[]) {
    const counts = Array.from({ length: 6 }, () => 0);
    this.dices.forEach(dice => counts[dice.num - 1]++);
    fields.forEach(field => {
      if (field.value !== undefined)
        return;
      let preview = 0;
      if (field.fieldId === "Ones") {
        preview = counts[0] * 1;
      } else if (field.fieldId === "Twos") {
        preview = counts[1] * 2;
      } else if (field.fieldId === "Threes") {
        preview = counts[2] * 3;
      } else if (field.fieldId === "Fours") {
        preview = counts[3] * 4;
      } else if (field.fieldId === "Fives") {
        preview = counts[4] * 5;
      } else if (field.fieldId === "Sixes") {
        preview = counts[5] * 6;
      }
      if (this.activeTurnEffectIds.has("Double Value")) {
        preview = preview * this.multiplier;
      }
      field.value = preview.toString();
      field.isPreview = true;
    });
  }

  sendAll(socket?: AppSocket) {
    if (socket) {
      socket.emit("send", {
        kind: "set ",
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

  joinPlayers(userId: string) {
    // console.log("join", userId, this.players)
    if (this.state.kind !== "lobby")
      return;
    if (this.getPlayer(userId))
      return;
    if (this.players.length > 10)
      return;

    this.players.push(this.makePlayer(userId));
    this.sendAll();
  }

  leavePlayers(userId: string) {
    // console.log("leave", userId, this.players)
    if (this.state.kind !== "lobby")
      return;
    if (!this.getPlayer(userId))
      return;

    this.players = this.players.filter(player => player.userId !== userId);
    this.sendAll();
  }

  // toIO(): GameIO {
  //   return {
  //     players: this.players.map(player => player.toIO()),
  //     dices: this.dices.map(dice => dice.toIO()),
  //     activePlayerId: this.activePlayerId,
  //     rollCount: this.rollCount,
  //     state: this.state
  //   };
  // }
}

type RoomSocketData = {
  userId?: string;
};

type RoomUserIdData = {
  socket?: AppSocket;
};

class Room {
  public socketMap: Map<AppSocket, RoomSocketData> = new Map();
  public userIdMap: Map<string, RoomUserIdData> = new Map();
  public game: Game = new Game();

  getUserId(socket: AppSocket): string | undefined {
    const userId = this.socketMap.get(socket)?.userId;
    if (!userId)
      return undefined;
    if (this.userIdMap.get(userId)?.socket !== socket) {
      return undefined;
    }
    return userId;
  }

  onClientData(socket: AppSocket, clientData: ClientData, clientDataCb: ClientDataCb = () => { }) {
    // console.log("reached... here", clientData);
    const { kind, data } = clientData;
    const userId = this.getUserId(socket);
    if (!userId)
      return;
    if (kind === "join players") {
      this.game.joinPlayers(userId);
    } else if (kind === "leave players") {
      this.game.leavePlayers(userId);
    } else if (kind === "start game") {
      this.game.startGame(userId);
    } else if (kind === "roll dices") {
      this.game.rollDices(userId);
    } else if (kind === "select dices") {
      this.game.selectDices(userId, data.selected);
    } else if (kind === "select field") {
      this.game.selectField(userId, data.fieldId);
    } else if (kind === "select effect") {
      this.game.selectEffect(userId, data.fieldId);
    }
  }

  joinRoom(socket: AppSocket, userId?: string) {
    this.leaveRoom(socket);
    userId = userId ?? "";
    userId = userId.trim()
    socket.join("room");
    this.socketMap.set(socket, { userId });
    if (userId && !this.userIdMap.get(userId)?.socket) {
      this.userIdMap.set(userId, { socket });
      this.game.joinPlayers(userId);
    }
    this.game.sendAll(socket);
  }

  leaveRoom(socket: AppSocket) {
    const userId = this.getUserId(socket);
    if (userId) {
      this.game.leavePlayers(userId);
      this.userIdMap.delete(userId);
    }
    this.socketMap.delete(socket);
    socket.leave("room");
  }
}

class System {
  public room = new Room()

  onClientData(socket: AppSocket, clientData: ClientData, clientDataCb: ClientDataCb = () => { }) {
    const { kind, data } = clientData;
    if (kind === "join room") {
      this.room.joinRoom(socket, data.userId);
    } else if (kind === "leave room") {
      this.room.leaveRoom(socket);
    } else {
      this.room.onClientData(socket, clientData, clientDataCb);
    }
  }
}

export const system = new System();