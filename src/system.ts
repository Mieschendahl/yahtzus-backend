import { AppSocket, io } from "./server";
import { ClientData, EFFECT_IDS, EffectId, FIELD_IDS, FieldId, FieldType, PlayerType, ServerData, getField, DiceType, StateType, getEffectId, getFieldValues } from "./shared/socket-types";
import { random } from "./utils";

export class Dice {
  constructor(
    public value: number = 1,
    public selected: boolean = true
  ) { }

  static rollDice(dice: Dice[], effectId?: EffectId) {
    const selectedDice = random.shuffle(dice.filter(die => die.selected));
    const values = [1, 2, 3, 4, 5, 6];

    selectedDice.forEach(die => {
      if (effectId === "high") {
        die.value = random.pick(values.filter(value => value >= die.value));
      } else if (effectId === "low") {
        die.value = random.pick(values.filter(value => value <= die.value));
      } else if (effectId === "not") {
        die.value = random.pick(values.filter(value => value != die.value));
      } else if (effectId === "flip") {
        die.value = 7 - die.value;
      } else {
        die.value = random.integer(1, 6);
      }
    });

    if (effectId === "pair" && selectedDice.length >= 2) {
      selectedDice[1].value = selectedDice[0].value;
    }
  }

  toTyped(): DiceType {
    return {
      value: this.value,
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
  private rollCount: number = 0;
  private rollMax: number = 3;
  private state: StateType = "lobby";
  private effectIds: EffectId[] = FIELD_IDS.map(_ => undefined);
  private activeEffectId?: EffectId;

  private createEffectIds(undefinedCount = 16) {
    const availableEffectIds = EFFECT_IDS.flatMap(effectId =>
      Array.from({ length: 3 }, () => effectId)
    ).concat(
      Array.from({ length: undefinedCount }, () => undefined)
    );

    this.effectIds = FIELD_IDS.map(() => {
      const idx = random.integer(0, availableEffectIds.length - 1);
      const [effectId] = availableEffectIds.splice(idx, 1);
      return effectId;
    });
  }

  private createPlayer(userId: string): Player {
    const fields: FieldType[] = FIELD_IDS.map(fieldId => {
      const effectId = getEffectId(fieldId, this.effectIds);
      const effectState = effectId === undefined ? undefined : "locked";
      return {
        fieldId,
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
    if (this.state !== "lobby")
      return;
    if (this.getPlayer(userId))
      return;
    this.players.push(this.createPlayer(userId));
    this.sendAll();
  }

  leavePlayers(userId: string) {
    if (this.state !== "lobby")
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

  private sendStaticGame(socket?: AppSocket) {
    const data: ServerData = {
      kind: "set static game",
      data: {
        game: {
          userIds: this.players.map(player => player.userId),
          effectIds: this.effectIds
        }
      }
    };
    this.sendData(data, socket);
  }

  private sendDynamicGame(socket?: AppSocket) {
    const data: ServerData = {
      kind: "set dynamic game",
      data: {
        game: {
          state: this.state,
          activeUserId: this.activePlayerIdx !== undefined ? this.players[this.activePlayerIdx].userId : undefined,
          rollCount: this.rollCount,
          activeEffect: this.activeEffectId
        }
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

  private sendPlayers(socket?: AppSocket) {
    const data: ServerData = {
      kind: "set players",
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
    this.sendStaticGame(socket);
    this.sendDynamicGame(socket);
    this.sendDice(socket);
    this.sendPlayers(socket);
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

  private advanceTurn() {
    this.rollCount = 0;
    this.rollMax = 3;
    this.dice = Dice.createDice();
    this.activePlayerIdx = (this.activePlayerIdx! + 1) % this.players.length;
    this.activeEffectId = undefined;
  }

  private isGameFinished(): boolean {
    return this.players.slice(-1)[0].fields.every(({fieldValue}) => fieldValue !== undefined);
  }

  startGame(userId: string, force: boolean = true) {
    if (!force && this.state !== "lobby")
      return;
    if (!this.getPlayer(userId))
      return;

    this.createEffectIds();
    this.players = this.players.map(player => this.createPlayer(player.userId));
    this.players = random.shuffle(this.players);
    this.dice = Dice.createDice();
    this.state = "playing";
    this.advanceTurn();
    this.activePlayerIdx = 0;
    this.sendAll();
  }

  rollDice(userId: string) {
    const player = this.getActivePlayer(userId);
    if (!player)
      return;
    if (this.rollCount! >= this.rollMax!)
      return;
    this.rollCount!++;
    Dice.rollDice(this.dice, this.activeEffectId);
    this.activeEffectId = undefined;
    this.sendDice();
    this.sendDynamicGame();
  }

  selectDices(userId: string, selected: boolean[]) {
    if (!this.getActivePlayer(userId))
      return;
    if (this.rollCount! === 0)
      return;
    this.dice.forEach((dice, i) => dice.selected = i < selected.length ? selected[i] : true);
    this.sendDice();
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
    const fields_ = getFieldValues(this.dice.map(dice => dice.toTyped()));
    field.fieldValue = getField(fieldId, fields_)?.fieldValue!;
    if (field.effectState !== undefined && field.fieldValue > 0) {
      field.effectState = "unlocked";
    }
    this.advanceTurn();
    this.sendField(
      userId,
      field
    );
    if (this.isGameFinished()) {
      this.state = "lobby";
    }
    this.sendDice();
    this.sendDynamicGame();
  }

  selectEffect(userId: string, fieldId: FieldId) {
    const player = this.getActivePlayer(userId);
    if (!player)
      return;
    if (this.rollCount === 0)
      return;
    if (this.activeEffectId !== undefined)
      return;
    const field = getField(fieldId, player.fields);
    if (!field)
      return;
    if (field.effectState !== "unlocked")
      return;
    const effectId = getEffectId(fieldId, this.effectIds);
    this.activeEffectId = effectId;
    field.effectState = "used";
    this.sendField(
      userId,
      field
    );
    this.sendDynamicGame();
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

  onClientData(socket: AppSocket, clientData: ClientData) {
    // console.log("reached... room", clientData);
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
    } else if (kind === "restart game") {
      this.game.startGame(userId, true);
    } else if (kind === "roll dices") {
      this.game.rollDice(userId);
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

  onClientData(socket: AppSocket, clientData: ClientData) {
    // console.log("reached... system", clientData);
    const { kind, data } = clientData;
    if (kind === "join room") {
      this.room.joinRoom(socket, data.userId);
    } else if (kind === "leave room") {
      this.room.leaveRoom(socket);
    } else {
      this.room.onClientData(socket, clientData);
    }
  }
}

export const system = new System();