export const FIELD_ID = [
  "ones",
  "twos",
  "threes",
  "fours",
  "fives",
  "sixes"
] as const;

export type FieldId = typeof FIELD_ID[number];

export type ColumnIO = Partial<Record<FieldId, number>>;

export function isFieldId(value: FieldId): boolean {
  return FIELD_ID.includes(value);
}

export type StateIO = (
  | {
    kind: "lobby",
    data?: undefined
  }
  | {
    kind: "playing"
    data?: undefined
  }
);

export type PlayerIO = {
  userId: string;
  column: ColumnIO;
};

export type DiceIO = {
  num: number;
  selected: boolean;
}

export type GameIO = {
  players: PlayerIO[]
  dices: DiceIO[];
  activePlayerId?: number;
  rollCount?: number;
  state: StateIO;
};

export type ClientData = (
  | {
    kind: "join room";
    data: {
      userId?: string
    }
  }
  | {
    kind: "leave room";
    data?: undefined;
  }
  | {
    kind: "join players";
    data: undefined
  }
  | {
    kind: "leave players";
    data?: undefined;
  }
  | {
    kind: "start game";
    data?: undefined;
  }
  | {
    kind: "roll dices";
    data?: undefined;
  }
  | {
    kind: "select dices";
    data?: {
      selected: boolean[]
    }
  }
  | {
    kind: "select field";
    data?: {
      fieldname: string
    }
  }
);

export type ClientToServerEvents = {
  send: (data: ClientData) => void
};

export type ServerData = (
  | {
    kind: "set game";
    data: GameIO;
  }
);

export type ServerToClientEvents = {
  send: (data: ServerData) => void;
};