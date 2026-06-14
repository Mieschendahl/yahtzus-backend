import { AppSocket, io } from "./server";
import { ClientData, ClientDataCb, EFFECT_IDS, EffectId, FIELD_DATA, FIELD_IDS, FieldId, FieldType, getFieldIndex, getFieldIdx, PlayerType, ServerData, StateType, getField } from "./shared/socket-types";
import { random } from "./utils";

export class Dice {
  constructor(
    public num: number = 1,
    public selected: boolean = true
  ) { }

  roll() {
    this.num = random.integer(1, 6)
  }

  toTyped(): DiceIO {
    return {
      num: this.num,
      selected: this.selected
    };
  }

  static createDice(length: number = 5): Dice[] {
    return Array.from({ length }, () => new Dice());
  }
}

export class Player {
  constructor(
    public userId: string,
    public fields: FieldType[]
  ) { }

  toTyped(): PlayerType {
    return {
      userId: this.userId,
      fields: this.fields
    };
  }
}

class Game {
  private players: Player[] = [];
  private dice: Dice[] = Dice.createDice();
  private activePlayerIdx?: number;
  private rollCount?: number = 0;
  private rollMax?: number = 3;
  private multiplier: number = 1;
  private state: StateType = "lobby";
  private fieldIdToEffectId: Map<FieldId, EffectId | undefined> = new Map();
  private activeEffectIds: { rollBased: Set<EffectId>, turnBased: Set<EffectId> } = { rollBased: new Set(), turnBased: new Set() };

  private createEffectMap() {
    this.fieldIdToEffectId.clear();
    FIELD_IDS.forEach(fieldId => {
      const effectId = random.pick([undefined, random.pick(EFFECT_IDS)]);
      this.fieldIdToEffectId.set(fieldId, effectId);
    });
  }

  private createPlayer(userId: string): Player {
    const fields: FieldType[] = FIELD_IDS.map(fieldId => {
      const effectId = this.fieldIdToEffectId.get(fieldId);
      const effectState = effectId === undefined ? undefined : "locked";
      return {
        fieldId,
        effectId,
        effectState
      };
    });
    return new Player(userId, fields);
  }

  private getPlayer(userId: string): Player | undefined {
    return this.players.find(player => player.userId === userId);
  }

  private getActivePlayer(userId?: string): Player | undefined {
    if (this.state !== "playing")
      return undefined;
    if (this.activePlayerIdx === undefined)
      return undefined;
    const player = this.players[this.activePlayerIdx];
    if (userId !== undefined && player.userId !== userId)
      return undefined;
    return player;
  }

  joinPlayers(userId: string) {
    if (this.state.kind !== "lobby")
      return;
    if (this.getPlayer(userId))
      return;
    this.players.push(this.createPlayer(userId));
    this.sendAll();
  }

  leavePlayers(userId: string) {
    if (this.state.kind !== "lobby")
      return;
    if (!this.getPlayer(userId))
      return;
    this.players = this.players.filter(player => player.userId !== userId);
    this.sendAll();
  }

  private sendData(data: object, socket?: AppSocket) {
    if (socket) {
      socket.emit("send", data as ServerData);
    } else {
      io.to("room").emit("send", data as ServerData);
    }
  }

  private sendState(socket?: AppSocket) {
    const data: ServerData = {
      kind: "set state",
      data: {
        state: this.state,
        userIds: this.players.map(player => player.userId),
        activePlayerIdx: this.activePlayerIdx,
        rollCount: this.rollCount,
        rollMax: this.rollMax
      }
    };
    this.sendData(data, socket);
  }

  private sendDice(socket?: AppSocket) {
    const data: ServerData = {
      kind: "set dice",
      data: {
        dice: this.dice.map(dice => dice.toTyped())
      }
    };
    this.sendData(data, socket);
  }

  private sendFields(socket?: AppSocket) {
    const data: ServerData = {
      kind: "set fields",
      data: {
        players: this.players.map(player => {
          return {
            userId: player.userId,
            fields: player.fields
          };
        })
      }
    };
    this.sendData(data, socket);
  }

  sendAll(socket?: AppSocket) {
    this.sendState(socket);
    this.sendDice(socket);
    this.sendFields(socket);
  }

  private sendField(userId: string, field: FieldType, socket?: AppSocket) {
    const data: ServerData = {
      kind: "set field",
      data: {
        userId,
        field
      }
    };
    this.sendData(data, socket);
  }

  private resetEffects(endTurn: boolean = false) {
    this.activeEffectIds.rollBased.clear();
    if (!endTurn)
      return;
    this.rollCount = 0;
    this.multiplier = 1;
    this.rollMax = 3;
    this.dice = Dice.createDice();
    this.activePlayerIdx = (this.activePlayerIdx! + 1) % this.players.length;
    this.activeEffectIds.turnBased.clear();
  }

  private getFieldValues(): FieldType[] {
    const counts = Array.from({ length: 6 }, () => 0);
    this.dice.forEach(dice => counts[dice.num - 1]++);
    return FIELD_IDS.map(fieldId => {
      let fieldValue = 0;
      if (fieldId === "ones") {
        fieldValue = counts[0] * 1;
      } else if (fieldId === "twos") {
        fieldValue = counts[1] * 2;
      } else if (fieldId === "threes") {
        fieldValue = counts[2] * 3;
      } else if (fieldId === "fours") {
        fieldValue = counts[3] * 4;
      } else if (fieldId === "fives") {
        fieldValue = counts[4] * 5;
      } else if (fieldId === "sixes") {
        fieldValue = counts[5] * 6;
      }
      fieldValue = fieldValue * this.multiplier;
      return {
        fieldId,
        fieldValue
      };
    });
  }

  startGame(userId: string) {
    if (this.state.kind !== "lobby")
      return;
    if (!this.getPlayer(userId))
      return;

    this.createEffectMap();
    this.players = this.players.map(player => this.createPlayer(player.userId));
    this.players = random.shuffle(this.players);
    this.dice = Dice.createDice();
    this.activePlayerIdx = 0;
    this.state = "playing";
    this.resetEffects(true);
    this.sendAll();
  }

  rollDices(userId: string) {
    const player = this.getActivePlayer(userId);
    if (!player)
      return;
    if (this.rollCount! >= this.rollMax!)
      return;
    this.rollCount!++;
    this.dice.forEach(dice => {
      if (dice.selected) {
        dice.roll();
      }
    });
    this.resetEffects();
    this.sendAll();
  }

  selectDices(userId: string, selected: boolean[]) {
    if (!this.getActivePlayer(userId))
      return;
    if (this.rollCount! === 0 || this.rollCount! >= 3)
      return;
    this.dice.forEach((dice, i) => dice.selected = i < selected.length ? selected[i] : true);
    this.sendAll();
  }

  selectField(userId: string, fieldId: FieldId) {
    const player = this.getActivePlayer(userId);
    if (!player)
      return;
    if (this.rollCount! === 0)
      return;
    const field = getField(fieldId, player.fields);
    if (!field)
      return;
    if (field.fieldValue !== undefined)
      return;
    field.fieldValue = getField(fieldId, this.getFieldValues())?.fieldValue!;
    if (field.effectState !== undefined && field.fieldValue > 0) {
      field.effectState = "unlocked";
    }
    this.resetEffects(true);
    this.sendAll();
  }

  selectEffect(userId: string, fieldId: FieldId) {
    const player = this.getActivePlayer(userId);
    if (!player)
      return;
    if (this.rollCount! === 0)
      return;
    const field = getField(fieldId, player.fields);
    if (!field)
      return;
    if (!field.effectId)
      return;
    if (field.effectState !== "unlocked")
      return;
    if (this.activeEffectIds.rollBased.has(field.effectId!) || this.activeEffectIds.turnBased.has(field.effectId!))
      return;
    field.effectState = "in use";
    if (field.effectId === "double") {
      this.activeEffectIds.turnBased.add(field.effectId);
      this.multiplier = 2;
    } else if (field.effectId === "dice") {
      this.activeEffectIds.turnBased.add(field.effectId);
      const die = new Dice();
      die.roll()
      this.dice.push(die);
    } else if (field.effectId === "roll") {
      this.activeEffectIds.turnBased.add(field.effectId);
      this.rollMax!++;
    }
    this.sendAll();
  }
}

class Room {
  private socketMap: Map<AppSocket, { userId?: string }> = new Map();
  private userIdMap: Map<string, { socket?: AppSocket }> = new Map();
  private game: Game = new Game();

  private getUserId(socket: AppSocket): string | undefined {
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